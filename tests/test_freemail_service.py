from src.services.freemail import FreemailService


def test_get_verification_code_prefers_newest_mail_after_otp_sent_at():
    service = FreemailService(
        {
            "base_url": "https://freemail.example.com",
            "admin_token": "token-1",
        }
    )

    otp_sent_at = 1_700_000_000.0
    polls = [
        [
            {
                "id": "mail-old",
                "sender": "noreply@openai.com",
                "subject": "OpenAI verification",
                "preview": "Your code is 111111",
                "createdAt": otp_sent_at - 30,
            },
            {
                "id": "mail-new",
                "sender": "noreply@openai.com",
                "subject": "OpenAI verification",
                "preview": "Your code is 222222",
                "createdAt": otp_sent_at + 5,
            },
        ]
    ]

    def fake_make_request(method, path, **kwargs):
        if method == "GET" and path == "/api/emails":
            return polls.pop(0) if polls else []
        raise AssertionError(f"unexpected request: {method} {path}")

    service._make_request = fake_make_request

    code = service.get_verification_code(
        email="tester@example.com",
        timeout=1,
        otp_sent_at=otp_sent_at,
    )

    assert code == "222222"


def test_get_verification_code_remains_backward_compatible_without_otp_sent_at():
    service = FreemailService(
        {
            "base_url": "https://freemail.example.com",
            "admin_token": "token-1",
        }
    )

    polls = [
        [
            {
                "id": "mail-legacy",
                "sender": "noreply@openai.com",
                "subject": "OpenAI verification",
                "preview": "Your code is 333333",
                "createdAt": "2026-04-02T10:00:00Z",
            }
        ]
    ]

    def fake_make_request(method, path, **kwargs):
        if method == "GET" and path == "/api/emails":
            return polls.pop(0) if polls else []
        raise AssertionError(f"unexpected request: {method} {path}")

    service._make_request = fake_make_request

    code = service.get_verification_code(
        email="tester@example.com",
        timeout=1,
        otp_sent_at=None,
    )

    assert code == "333333"
