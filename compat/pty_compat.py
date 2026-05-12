"""
PTY 兼容层
- Unix (Linux/Mac): ptyprocess
- Windows 7: pywinpty 0.5.7 (WinPTY legacy)
"""

import platform
import os

IS_WINDOWS = platform.system() == "Windows"

if IS_WINDOWS:
    from winpty import PtyProcess as WinPtyProcess

    def spawn_terminal(cwd=None):
        """Windows 终端启动"""
        shell = os.environ.get("COMSPEC", "cmd.exe")
        return WinPtyProcess.spawn(shell, cwd=cwd, dimensions=(80, 24))

    def resize_terminal(proc, rows, cols):
        """Windows 终端调整大小 (cols, rows)"""
        proc.set_size(cols, rows)

    def close_terminal(proc):
        """Windows 终端关闭"""
        proc.close()

    def read_pty(proc, size):
        """读取 PTY 数据"""
        data = proc.read(size)
        return data.encode() if isinstance(data, str) else data

else:
    import ptyprocess

    def spawn_terminal(cwd=None):
        """Unix 终端启动"""
        shell = os.environ.get("SHELL", "/bin/bash")
        return ptyprocess.PtyProcess.spawn([shell], cwd=cwd, dimensions=(24, 80))

    def resize_terminal(proc, rows, cols):
        """Unix 终端调整大小 (rows, cols)"""
        proc.setwinsize(rows, cols)

    def close_terminal(proc):
        """Unix 终端关闭"""
        proc.kill(9)

    def read_pty(proc, size):
        """读取 PTY 数据"""
        return proc.read(size)
