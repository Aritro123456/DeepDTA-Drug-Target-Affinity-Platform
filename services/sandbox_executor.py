import contextlib
import io
import multiprocessing
import os
import queue
import traceback
import tempfile

from flask import Flask, jsonify, request

try:
    import resource
except ImportError:
    resource = None


app = Flask(__name__)

MAX_CODE_BYTES = 32 * 1024
EXECUTION_TIMEOUT_SECONDS = 5
OUTPUT_LIMIT_BYTES = 64 * 1024

SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "pow": pow,
    "print": print,
    "range": range,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


def _apply_process_limits():
    if resource is not None:
        resource.setrlimit(resource.RLIMIT_CPU, (EXECUTION_TIMEOUT_SECONDS, EXECUTION_TIMEOUT_SECONDS))
        resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    os.chdir(tempfile.gettempdir())


def _run_code(code, result_queue):
    _apply_process_limits()
    output_buffer = io.StringIO()
    namespace = {
        "__builtins__": SAFE_BUILTINS,
        "__name__": "__sandbox__",
    }

    try:
        with contextlib.redirect_stdout(output_buffer), contextlib.redirect_stderr(output_buffer):
            exec(code, namespace, namespace)
        output = output_buffer.getvalue()
        result_queue.put({
            "success": True,
            "output": output[:OUTPUT_LIMIT_BYTES],
            "truncated": len(output.encode("utf-8")) > OUTPUT_LIMIT_BYTES,
        })
    except Exception:
        output = output_buffer.getvalue() + traceback.format_exc(limit=5)
        result_queue.put({
            "success": False,
            "error": output[:OUTPUT_LIMIT_BYTES],
            "truncated": len(output.encode("utf-8")) > OUTPUT_LIMIT_BYTES,
        })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/execute", methods=["POST"])
def execute():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    if not code:
        return jsonify({"success": False, "error": "No code provided"}), 400
    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        return jsonify({"success": False, "error": "Code cell is too large."}), 413

    result_queue = multiprocessing.Queue(maxsize=1)
    process = multiprocessing.Process(target=_run_code, args=(code, result_queue))
    process.start()
    process.join(EXECUTION_TIMEOUT_SECONDS + 1)

    if process.is_alive():
        process.terminate()
        process.join(1)
        return jsonify({"success": False, "error": "Execution timed out."}), 408

    try:
        result = result_queue.get_nowait()
    except queue.Empty:
        result = {"success": False, "error": "Sandbox process exited without output."}

    return jsonify(result), 200


if __name__ == "__main__":
    host = os.environ.get("SANDBOX_EXECUTOR_HOST", "127.0.0.1")
    port = int(os.environ.get("SANDBOX_EXECUTOR_PORT", "5050"))
    app.run(host=host, port=port, debug=False)
