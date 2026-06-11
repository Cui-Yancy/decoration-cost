"""装修管家 - Flask 后端"""
import sqlite3
import os
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__)

_base_dir = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.environ.get('DECORATION_DB')
if not DATABASE:
    _data_db = os.path.join(_base_dir, 'data', 'decoration.db')
    _legacy_db = os.path.join(_base_dir, 'decoration.db')
    DATABASE = _data_db if os.path.exists(_data_db) else _legacy_db
    del _data_db, _legacy_db
del _base_dir

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    return db

def init_db():
    db = get_db()
    db.execute('''CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY, category TEXT, area TEXT, name TEXT,
        brand TEXT, model TEXT, status TEXT, channel TEXT,
        price TEXT, quantity TEXT, purchaseDate TEXT, imageUrl TEXT,
        notes TEXT, date TEXT, amount REAL, createdAt TEXT,
        updatedAt TEXT, _schemaVersion INTEGER DEFAULT 1
    )''')
    db.commit()
    db.close()

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def parse_json_fields(record):
    """确保数值字段类型正确"""
    if record.get('price'):
        record['price'] = str(record['price'])
    if record.get('quantity'):
        record['quantity'] = str(record['quantity'])
    if record.get('amount') is not None:
        record['amount'] = float(record['amount'])
    return record

# --- 静态文件 ---

@app.route('/api/status')
def api_status():
    db = get_db()
    expense_count = db.execute('SELECT COUNT(*) FROM expenses').fetchone()[0]
    db.close()
    return jsonify({
        'database': DATABASE,
        'expenses': expense_count
    })

@app.route('/')
def index():
    return serve_html('index.html')

@app.route('/<path:filename>')
def static_files(filename):
    if filename.endswith('.html'):
        return serve_html(filename)
    return send_from_directory('.', filename)

def serve_html(filename):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    if not os.path.exists(path):
        return "Not found", 404

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    inject = '<script>window.APP_MODE="server";window.API_BASE="";</script>'
    content = re.sub(r'(<script src="js/app-)', inject + r'\1', content, count=1)

    return content, 200, {'Content-Type': 'text/html; charset=utf-8'}

# --- 支出记录 API ---

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    db = get_db()
    rows = db.execute('SELECT * FROM expenses ORDER BY id DESC').fetchall()
    db.close()
    records = [parse_json_fields(row_to_dict(r)) for r in rows]
    return jsonify(records)

@app.route('/api/expenses', methods=['POST'])
def create_expense():
    record = request.get_json()
    if not record or not record.get('id'):
        return jsonify({'error': '缺少 id'}), 400

    record = parse_json_fields(record)
    record.setdefault('_schemaVersion', 1)
    record.setdefault('createdAt', datetime.now().isoformat())

    db = get_db()
    columns = ', '.join(record.keys())
    placeholders = ', '.join(['?' for _ in record])
    values = list(record.values())
    db.execute(f'INSERT OR REPLACE INTO expenses ({columns}) VALUES ({placeholders})', values)
    db.commit()
    db.close()
    return jsonify(record), 201

@app.route('/api/expenses/<record_id>', methods=['PUT'])
def update_expense(record_id):
    record = request.get_json()
    if not record:
        return jsonify({'error': '无数据'}), 400

    record['updatedAt'] = datetime.now().isoformat()
    record['id'] = record_id
    record = parse_json_fields(record)

    db = get_db()
    set_clause = ', '.join([f'{k}=?' for k in record.keys()])
    values = list(record.values())
    db.execute(f'INSERT OR REPLACE INTO expenses ({", ".join(record.keys())}) VALUES ({", ".join(["?" for _ in record])})', values)
    db.commit()
    db.close()
    return jsonify(record)

@app.route('/api/expenses/<record_id>', methods=['GET'])
def get_expense(record_id):
    db = get_db()
    row = db.execute('SELECT * FROM expenses WHERE id=?', (record_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': '未找到'}), 404
    return jsonify(parse_json_fields(row_to_dict(row)))

@app.route('/api/expenses/<record_id>', methods=['DELETE'])
def delete_expense(record_id):
    db = get_db()
    db.execute('DELETE FROM expenses WHERE id=?', (record_id,))
    db.commit()
    db.close()
    return jsonify({'success': True})

@app.route('/api/expenses', methods=['DELETE'])
def clear_expenses():
    db = get_db()
    db.execute('DELETE FROM expenses')
    db.commit()
    db.close()
    return jsonify({'success': True})

# --- 批量导入（从JSON迁移） ---

@app.route('/api/migrate/expenses', methods=['POST'])
def migrate_expenses():
    records = request.get_json()
    if not isinstance(records, list):
        return jsonify({'error': '需要 JSON 数组'}), 400

    db = get_db()
    existing = {r['id'] for r in db.execute('SELECT id FROM expenses').fetchall()}
    imported = 0
    for r in records:
        if r.get('id') in existing:
            continue
        r = parse_json_fields(r)
        r.setdefault('_schemaVersion', 1)
        r.setdefault('createdAt', datetime.now().isoformat())
        columns = ', '.join(r.keys())
        placeholders = ', '.join(['?' for _ in r])
        db.execute(f'INSERT INTO expenses ({columns}) VALUES ({placeholders})', list(r.values()))
        existing.add(r['id'])
        imported += 1
    db.commit()
    db.close()
    return jsonify({'imported': imported})

def import_json_file(filepath, store_type=None):
    """从 JSON 文件导入数据到 SQLite"""
    with open(filepath, 'r', encoding='utf-8') as f:
        records = json.load(f)

    if not isinstance(records, list) or len(records) == 0:
        print('错误: JSON 文件应包含非空数组')
        return

    # 自动检测类型：当前版本只导入支出记录
    if store_type is None:
        sample = records[0]
        if 'category' in sample or 'price' in sample or 'brand' in sample:
            store_type = 'expenses'
        else:
            print('错误: 无法自动识别支出记录，请确认 JSON 包含 category、price 或 brand 字段')
            return

    print(f'检测到数据类型: {store_type}，共 {len(records)} 条记录')

    db = get_db()
    table = 'expenses'
    existing = {r['id'] for r in db.execute(f'SELECT id FROM {table}').fetchall()}
    imported = 0
    skipped = 0

    for r in records:
        if r.get('id') in existing:
            skipped += 1
            continue

        r = parse_json_fields(r)

        r.setdefault('_schemaVersion', 1)
        r.setdefault('createdAt', datetime.now().isoformat())

        if 'id' not in r or not r['id']:
            r['id'] = datetime.now().strftime('%Y%m%d%H%M%S%f') + str(imported)

        columns = ', '.join(r.keys())
        placeholders = ', '.join(['?' for _ in r])
        db.execute(f'INSERT INTO {table} ({columns}) VALUES ({placeholders})', list(r.values()))
        existing.add(r['id'])
        imported += 1

    db.commit()
    db.close()
    print(f'导入完成: {imported} 条新增, {skipped} 条跳过(重复)')
    print(f'数据库: {DATABASE}')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='装修管家服务')
    parser.add_argument('--import', dest='import_file', metavar='FILE.json',
                        help='导入旧版 JSON 数据到数据库')
    parser.add_argument('--type', dest='import_type', choices=['expenses'],
                        help='数据类型 (当前支持 expenses，默认自动检测)')
    parser.add_argument('--host', default='0.0.0.0', help='服务监听地址 (默认: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=5000, help='服务端口 (默认: 5000)')
    parser.add_argument('--debug', action='store_true', help='开启 Flask 调试模式')
    args = parser.parse_args()

    init_db()

    if args.import_file:
        import_json_file(args.import_file, args.import_type)

    print(f'装修管家服务启动: http://{args.host}:{args.port}')
    print(f'数据库: {DATABASE}')
    app.run(host=args.host, port=args.port, debug=args.debug)
