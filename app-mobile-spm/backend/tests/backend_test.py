"""Backend API tests for Saúde na Palma da Mão - Iteration 2."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL"
) else "https://patient-mobile-app-1.preview.emergentagent.com"

DEMO_EMAIL = "demo" + chr(64) + "saudepalma.com.br"
DEMO_PASSWORD = "senha123"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def fresh_user(api):
    """A fresh user, isolated from demo, so we can test double-booking cleanly."""
    rnd = uuid.uuid4().hex[:8]
    email = f"test_{rnd}" + chr(64) + "exemplo.com.br"
    r = api.post(f"{BASE_URL}/api/auth/register",
                 json={"email": email, "password": "senha123", "name": "Test User"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        "email": email,
        "token": data["access_token"],
        "id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}",
                    "Content-Type": "application/json"},
    }


# ---------- Health ----------
def test_health_root_v2(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    j = r.json()
    assert "v2" in j.get("message", "")


# ---------- Auth ----------
class TestAuth:
    def test_login_demo_user(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["user"]["email"] == DEMO_EMAIL
        assert "_id" not in d["user"]

    def test_login_wrong_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": DEMO_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_get_me(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == DEMO_EMAIL
        assert "_id" not in d

    def test_update_me_new_fields(self, api, auth_headers):
        payload = {
            "phone": "(11) 91234-5678",
            "address": "Rua Teste, 42",
            "mother_name": "Mãe Teste",
            "father_name": "Pai Teste",
            "birth_certificate": "BC-123",
            "marriage_certificate": "MC-456",
            "birthdate": "01/01/1990",
            "gender": "Feminino",
            "photo_base64": "data:image/png;base64,iVBORw0KGgo=",
        }
        r = api.put(f"{BASE_URL}/api/auth/me", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        for k, v in payload.items():
            assert d[k] == v, f"{k} not persisted"
        # GET verify persistence
        g = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers).json()
        assert g["phone"] == payload["phone"]
        assert g["mother_name"] == payload["mother_name"]

    def test_update_email_duplicate_returns_400(self, api, fresh_user, auth_headers):
        # Attempt to change demo user's email to fresh_user's email
        r = api.put(f"{BASE_URL}/api/auth/me", headers=auth_headers,
                    json={"email": fresh_user["email"]})
        assert r.status_code == 400, f"Expected 400 for duplicate email, got {r.status_code} {r.text}"


# ---------- Catalogs ----------
class TestCatalogs:
    def test_specialties(self, api):
        r = api.get(f"{BASE_URL}/api/specialties")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) == 10, f"Expected 10 specialties, got {len(arr)}"
        for s in arr:
            for k in ("key", "icon", "description", "treats", "doctors"):
                assert k in s, f"missing key {k} in specialty {s}"
            assert isinstance(s["treats"], list) and len(s["treats"]) >= 3
            assert isinstance(s["doctors"], list) and len(s["doctors"]) >= 1

    def test_allergies_catalog(self, api):
        r = api.get(f"{BASE_URL}/api/allergies/catalog")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)
        assert len(d["items"]) >= 15, f"Expected >=15 allergies, got {len(d['items'])}"


# ---------- Available Slots ----------
class TestAvailableSlots:
    def test_available_slots_shape(self, api, fresh_user):
        date = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
        r = api.get(f"{BASE_URL}/api/doctors/Cl%C3%ADnico%20Geral/available_slots"
                    f"?doctor_name=Dra.%20Maria%20Silva&date={date}",
                    headers=fresh_user["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert "available" in d and "taken" in d
        assert isinstance(d["available"], list)
        assert isinstance(d["taken"], list)

    def test_available_slots_after_booking(self, api, fresh_user):
        date = (datetime.now(timezone.utc) + timedelta(days=6)).strftime("%Y-%m-%d")
        scheduled = f"{date}T10:00:00+00:00"
        # book a slot
        booking = {
            "doctor_name": "Dr. Slot Test",
            "specialty": "Clínico Geral",
            "location": "UBS Test",
            "scheduled_at": scheduled,
        }
        r = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json=booking)
        assert r.status_code == 200, r.text
        # Check slots
        r2 = api.get(f"{BASE_URL}/api/doctors/Cl%C3%ADnico%20Geral/available_slots"
                     f"?doctor_name=Dr.%20Slot%20Test&date={date}",
                     headers=fresh_user["headers"])
        assert r2.status_code == 200
        d = r2.json()
        assert "10:00" in d["taken"]
        assert "10:00" not in d["available"]


# ---------- Appointments ----------
class TestAppointments:
    def test_list(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/appointments", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 3

    def test_double_book_same_doctor_same_time_returns_409(self, api, fresh_user):
        when = (datetime.now(timezone.utc) + timedelta(days=10)).replace(microsecond=0)
        when_iso = when.isoformat().replace("+00:00", "+00:00")
        payload = {
            "doctor_name": "Dr. Double Book Test",
            "specialty": "Cardiologista",
            "location": "UBS X",
            "scheduled_at": when_iso,
        }
        r1 = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json=payload)
        assert r1.status_code == 200, r1.text
        # Second time with same doctor+specialty+time must conflict
        r2 = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json=payload)
        assert r2.status_code == 409, f"Expected 409, got {r2.status_code} {r2.text}"

    def test_cancel_requires_reason_422(self, api, fresh_user):
        when_iso = (datetime.now(timezone.utc) + timedelta(days=11)).isoformat()
        r = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json={
            "doctor_name": "Dr. Cancel Test", "specialty": "Clínico Geral",
            "location": "UBS", "scheduled_at": when_iso,
        })
        assert r.status_code == 200, r.text
        apt_id = r.json()["id"]
        # No body
        r2 = api.post(f"{BASE_URL}/api/appointments/{apt_id}/cancel",
                      headers=fresh_user["headers"])
        assert r2.status_code == 422, f"Expected 422 without reason, got {r2.status_code}"
        # Short reason
        r3 = api.post(f"{BASE_URL}/api/appointments/{apt_id}/cancel",
                      headers=fresh_user["headers"], json={"reason": "ab"})
        assert r3.status_code == 422

    def test_cancel_with_reason_success(self, api, fresh_user):
        when_iso = (datetime.now(timezone.utc) + timedelta(days=12)).isoformat()
        r = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json={
            "doctor_name": "Dr. Cancel OK", "specialty": "Clínico Geral",
            "location": "UBS", "scheduled_at": when_iso,
        })
        assert r.status_code == 200, r.text
        apt_id = r.json()["id"]
        r2 = api.post(f"{BASE_URL}/api/appointments/{apt_id}/cancel",
                      headers=fresh_user["headers"],
                      json={"reason": "Não poderei comparecer no horário"})
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["status"] == "cancelled"
        assert d["cancellation_reason"] == "Não poderei comparecer no horário"
        # Persistence
        g = api.get(f"{BASE_URL}/api/appointments/{apt_id}",
                    headers=fresh_user["headers"]).json()
        assert g["status"] == "cancelled"
        assert g["cancellation_reason"] == "Não poderei comparecer no horário"


# ---------- Notifications ----------
class TestNotifications:
    def test_notifications_shape(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)

    def test_notifications_upcoming_appointment_within_48h(self, api, fresh_user):
        when = (datetime.now(timezone.utc) + timedelta(hours=24)).replace(microsecond=0)
        r = api.post(f"{BASE_URL}/api/appointments", headers=fresh_user["headers"], json={
            "doctor_name": "Dr. Notif Test", "specialty": "Clínico Geral",
            "location": "UBS", "scheduled_at": when.isoformat(),
        })
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/api/notifications", headers=fresh_user["headers"])
        assert r2.status_code == 200
        items = r2.json()["items"]
        kinds = [i["kind"] for i in items]
        assert "appointment" in kinds, f"Expected upcoming appointment notif, got {items}"


# ---------- Help ----------
class TestHelp:
    def test_faq(self, api):
        r = api.get(f"{BASE_URL}/api/help/faq")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list) and len(d["items"]) >= 3
        for it in d["items"]:
            assert "q" in it and "a" in it


# ---------- Medications REMOVED ----------
class TestMedicationsRemoved:
    @pytest.mark.parametrize("path", [
        "/api/medications",
        "/api/medications/anything",
        "/api/medications/anything/logs",
    ])
    def test_medications_get_endpoints_removed(self, api, auth_headers, path):
        r = api.get(f"{BASE_URL}{path}", headers=auth_headers)
        assert r.status_code == 404, f"{path} expected 404, got {r.status_code}"

    def test_medications_post_removed(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/medications", headers=auth_headers,
                     json={"name": "X", "dosage": "1", "times_per_day": 1,
                           "schedule": ["09:00"], "stock": 1, "total_stock": 1})
        assert r.status_code == 404

    def test_medications_take_removed(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/medications/take", headers=auth_headers,
                     json={"medication_id": "xxx"})
        assert r.status_code == 404


# ---------- Exams ----------
class TestExams:
    def test_list(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/exams", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 3

    def test_get_404(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/exams/does-not-exist", headers=auth_headers)
        assert r.status_code == 404
