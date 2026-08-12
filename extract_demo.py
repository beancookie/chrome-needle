from pydantic import BaseModel
import needle
from translator import maybe_translate


class Invoice(BaseModel):
    vendor: str
    total: float
    due_date: str


class Contact(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    company: str | None = None


class Event(BaseModel):
    title: str
    date: str
    time: str | None = None
    location: str | None = None


EXAMPLES = [
    (Invoice, "来自阿克米公司的发票，金额1200美元，到期日2026年9月1日"),
    (Contact, "张三在谷歌工作，邮箱zhangsan@google.com，电话+86-138-0000-1234"),
    (Event, "下周一团队会议，下午3点，在B会议室"),
]


def main():
    print("=" * 50)
    print("  Needle 2 Structured Extraction Demo (中文)")
    print("=" * 50)

    for model_class, text in EXAMPLES:
        print(f"\n[Input  ] {text}")
        en_text, original = maybe_translate(text)
        if original:
            print(f"[Trans  ] {en_text}")
        result = needle.extract(en_text, model_class)
        print(f"[Output ] {model_class.__name__}: {result.model_dump()}")
        print("-" * 40)


if __name__ == "__main__":
    main()
