# Inventory Backend

Django + Django REST Framework backend for the React inventory app.

## 1. Create MySQL Database

Use `utf8mb4` so one text input can safely store Thai or English.

```sql
CREATE DATABASE inventory_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'inventory_password';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_user'@'localhost';
FLUSH PRIVILEGES;
```

If you use a different MySQL username or password, put those values in `.env`.

## 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Then edit `.env` if your MySQL credentials are different.

## 3. Install Dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 4. Create Tables

```bash
python manage.py migrate
```

## 5. Run Backend

```bash
python manage.py runserver 127.0.0.1:8000
```

API home:

```text
http://127.0.0.1:8000/api/
```

## Frontend Connection

The frontend already defaults to:

```text
http://127.0.0.1:8000/api
```

If needed, set this in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```
