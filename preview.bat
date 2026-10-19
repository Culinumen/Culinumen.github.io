@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem 有 Python 就起一个本地静态服务并打开浏览器；没有就直接打开 index.html
where python >nul 2>nul
if errorlevel 1 (
  echo 未检测到 python，直接用浏览器打开 index.html。
  start "" "%~dp0index.html"
  exit /b
)

echo 正在启动本地预览服务：http://127.0.0.1:8123/
echo 关闭标题为「本地预览服务 8123」的窗口即可停止服务。
start "本地预览服务 8123" cmd /c "python -m http.server 8123 --bind 127.0.0.1"
timeout /t 2 >nul
start "" "http://127.0.0.1:8123/"
