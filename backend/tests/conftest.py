from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture()
def settings() -> Settings:
    return Settings(
        app_name="IPO Poster Studio (test)",
        env="test",
        secret_key="test-secret-key",
        admin_email="admin@test.dev",
        admin_password="admin-pass-123",
        payments_mode="test",
        razorpay_webhook_secret="whsec_test",
        cors_origins=["http://localhost:3000"],
        persistence="memory",
        max_body_bytes=1_000_000,
        source_cache_ttl_seconds=60,
        stale_after_minutes=90,
    )


@pytest.fixture()
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture()
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def client_live(settings: Settings):
    """Same app but with live payment mode (used for payment security tests)."""
    live = Settings(**{**settings.__dict__, "payments_mode": "live"})
    with TestClient(create_app(live)) as test_client:
        yield test_client


def register(client: TestClient, email: str = "user@test.dev",
             password: str = "password123") -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "business_name": "Test Biz"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def login_admin(client: TestClient, email: str = "admin@test.dev",
                password: str = "admin-pass-123") -> dict:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
