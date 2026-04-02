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


def test_get_verification_code_parses_received_at_naive_as_utc():
    service = FreemailService(
        {
            "base_url": "https://freemail.example.com",
            "admin_token": "token-1",
        }
    )

    # 2026-04-02 04:46:09.747 UTC
    otp_sent_at = 1_775_105_169.747
    polls = [
        [
            {
                "id": "mail-utc-naive",
                "sender": "noreply@openai.com",
                "subject": "OpenAI verification",
                "preview": "Your code is 444444",
                # Freemail forensic format without timezone; should be interpreted as UTC
                "received_at": "2026-04-02 04:46:11",
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
        otp_sent_at=otp_sent_at,
    )

    assert code == "444444"


def test_get_verification_code_unknown_timestamp_fallback_keeps_fresh_mail():
    service = FreemailService(
        {
            "base_url": "https://freemail.example.com",
            "admin_token": "token-1",
        }
    )

    otp_sent_at = 1_775_105_169.747
    polls = [
        [
            {
                "id": "mail-no-ts",
                "sender": "noreply@openai.com",
                "subject": "OpenAI verification",
                "preview": "Your code is 555555",
                "received_at": "not-a-time",
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
        timeout=20,
        otp_sent_at=otp_sent_at,
    )

    assert code == "555555"
