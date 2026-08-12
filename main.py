import json
import needle
from tools import ALL_TOOLS
from translator import maybe_translate

CONFIDENCE_THRESHOLD = 0.7
SYSTEM_CONTEXT = "date: 2026-08-12 Wed; locale: zh-CN; device: laptop"


def _exec_by_name(name, arguments):
    for tool in ALL_TOOLS:
        if tool.__name__ == name:
            return tool(**arguments)
    return {"error": f"unknown tool: {name}"}


def _print_response(response):
    print(f"  [confidence] {response.get('confidence', 0):.2f}")
    print(f"  [speed] prefill {response.get('prefill_tps', 0):.0f} t/s | decode {response.get('decode_tps', 0):.0f} t/s")
    print(f"  [ram] {response.get('peak_ram_mb', 0):.1f} MB")


def main():
    print("=" * 60)
    print("  Needle 2 Tool Calling Demo")
    print(f"  Model: 45M params | Confidence threshold: {CONFIDENCE_THRESHOLD}")
    print("=" * 60)

    agent = needle.Needle(tools=ALL_TOOLS, system=SYSTEM_CONTEXT)

    try:
        while True:
            user_input = input("\nYou: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                agent.reset()
                print("Goodbye!")
                break

            turn, original = maybe_translate(user_input)
            if original:
                print(f"  [translated] {original} -> {turn}")

            while True:
                response = agent.complete(turn)
                rtype = response.get("type")

                if rtype == "call":
                    calls = response.get("function_calls", [])
                    if not calls:
                        print("  [refused] no matching tool")
                        _print_response(response)
                        break

                    for call in calls:
                        name = call["name"]
                        args = call["arguments"]
                        print(f"  [call] {name}({json.dumps(args, ensure_ascii=False)})")

                    _print_response(response)
                    confidence = response.get("confidence", 0)
                    if confidence < CONFIDENCE_THRESHOLD:
                        print(f"  [warning] confidence below threshold ({CONFIDENCE_THRESHOLD})")

                    for call in calls:
                        result = _exec_by_name(call["name"], call["arguments"])
                        print(f"  [result] {json.dumps(result, ensure_ascii=False)}")

                    turn = json.dumps({c["name"]: _exec_by_name(c["name"], c["arguments"]) for c in calls})

                elif rtype == "respond":
                    print(f"  [answer] {response.get('reasoning', '')}")
                    _print_response(response)
                    break

                else:
                    print(f"  [unknown] type={rtype}")
                    break

    except KeyboardInterrupt:
        print("\nGoodbye!")


if __name__ == "__main__":
    main()
