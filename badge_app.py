
import display
import os
import json
import system
import sys
import wifi
import woezel

def mkdir(path):
    return os.mkdir(path)

def lsdir(path):
    return os.listdir(path)

def read(path):
    with open(path, "rb") as file_to_read:
        return file_to_read.read()

def read_bin(path, offset):
    with open(path, "rb") as file_to_read:
        file_to_read.seek(offset)
        return tuple(bytearray(file_to_read.read(1024)))

def write(path, contents):
    with open(path, "wb") as file_to_write:
        return file_to_write.write(contents)

def install_app(appname):
    wifi.connect()
    return woezel.install_pkg(appname, "/apps/", False)


def exec_app(appname, hard=False):
    if hard:
        system.start(appname)
    else:
        try:
            __import__(appname)
        except Exception as err:
            reset_display()
            return str(err)
        except KeyboardInterrupt:
            reset_display()
            return "ctrl+c pressed"
        finally:
            del sys.modules[appname]


def reset_display():
    display.drawFill(0xFFFFFF)
    display.drawText(10, 10, "Web USB mode", 0x00FF00, "permanentmarker22")
    display.flush()


def main():
    received = ""
    reset_display()

    while True:
        received += input() + "\n"
        #print(received)
        try:
            parsed = json.loads(received)
        except:
            continue
        
        received = ""
        cmd = parsed["cmd"]
        try:
            if cmd == "lsdir":
                result = lsdir(parsed["path"])
            elif cmd == "mkdir":
                result = mkdir(parsed["path"])
            elif cmd == "read":
                result = read(parsed["path"])
            elif cmd == "read_bin":
                result = read_bin(parsed["path"], parsed.get("offset", 0))
            elif cmd == "write":
                result = write(parsed["path"], parsed["data"])
            elif cmd == "exec_app":
                result = exec_app(parsed["app"])
            elif cmd == "install_app":
                result = install_app(parsed["app"])
            else:
                result = ValueError("Command not known")
        except Exception as err:
            response = {"command": parsed, "ok": False, "error": str(err)}
        else:
            response = {"command": parsed, "ok": True, "result": result}
        if cmd == "read_bin":
            response["hex"] = response["result"]
            del response["result"]
        print(json.dumps(response))
        print()


main()
