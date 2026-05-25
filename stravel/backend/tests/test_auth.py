from app.core.auth import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hashing():
    password = "test_password_123"
    hashed = hash_password(password)
    assert verify_password(password, hashed)
    assert not verify_password("wrong_password", hashed)


def test_create_and_decode_token():
    token = create_access_token(tenant_id="tenant-1", user_id="user-1", email="test@example.com")
    payload = decode_access_token(token)
    assert payload["tenant_id"] == "tenant-1"
    assert payload["sub"] == "user-1"
    assert payload["email"] == "test@example.com"


def test_token_contains_required_claims():
    token = create_access_token(tenant_id="t-1", user_id="u-1", email="a@b.com")
    payload = decode_access_token(token)
    assert "exp" in payload
    assert "tenant_id" in payload
    assert "sub" in payload
