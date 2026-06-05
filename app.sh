#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/run/app.pid"
LOG_FILE="$APP_DIR/logs/app.log"
HOST="${APP_HOST:-0.0.0.0}"
PORT="${APP_PORT:-5000}"

if [[ -x "$APP_DIR/.venv/bin/python" ]]; then
    PYTHON="$APP_DIR/.venv/bin/python"
else
    PYTHON="python3"
fi

usage() {
    cat <<EOF
Usage: $0 {start|stop|restart|status|logs}

Environment:
  APP_HOST    Host to bind, default: 0.0.0.0
  APP_PORT    Port to bind, default: 5000
EOF
}

read_pid() {
    if [[ -f "$PID_FILE" ]]; then
        tr -d '[:space:]' < "$PID_FILE"
    fi
}

is_running() {
    local pid
    pid="$(read_pid)"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

start() {
    mkdir -p "$APP_DIR/run" "$APP_DIR/logs"

    if is_running; then
        echo "装修管家已在后台运行，PID: $(read_pid)"
        echo "访问地址: http://$HOST:$PORT"
        return 0
    fi

    rm -f "$PID_FILE"
    touch "$LOG_FILE"

    cd "$APP_DIR"
    PYTHONUNBUFFERED=1 nohup "$PYTHON" "$APP_DIR/app.py" --host "$HOST" --port "$PORT" >> "$LOG_FILE" 2>&1 &
    echo "$!" > "$PID_FILE"

    sleep 1
    if is_running; then
        echo "装修管家已启动，PID: $(read_pid)"
        echo "访问地址: http://$HOST:$PORT"
        echo "日志文件: $LOG_FILE"
    else
        echo "启动失败，请查看日志: $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop() {
    if ! is_running; then
        echo "装修管家未运行"
        rm -f "$PID_FILE"
        return 0
    fi

    local pid
    pid="$(read_pid)"
    echo "正在停止装修管家，PID: $pid"
    kill "$pid"

    for _ in {1..10}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$PID_FILE"
            echo "装修管家已停止"
            return 0
        fi
        sleep 1
    done

    echo "进程未正常退出，强制停止"
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "装修管家已停止"
}

status() {
    if is_running; then
        echo "装修管家正在运行，PID: $(read_pid)"
        echo "访问地址: http://$HOST:$PORT"
        echo "日志文件: $LOG_FILE"
    else
        echo "装修管家未运行"
    fi
}

logs() {
    mkdir -p "$APP_DIR/logs"
    touch "$LOG_FILE"
    tail -f "$LOG_FILE"
}

case "${1:-}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        start
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        usage
        exit 1
        ;;
esac
