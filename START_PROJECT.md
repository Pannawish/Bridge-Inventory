# How To Start The Project

This project can run in two ways:

- Docker Compose, which starts MySQL, Django, and React/Vite together
- Manual local setup, where you run MySQL, Django, and React/Vite yourself

## Option A: Start With Docker

Docker Compose starts:

- MySQL database
- Django backend API
- React/Vite frontend

### Prerequisites

Install and start Docker Desktop before running the project.

Check that Docker is running:

```bash
docker info
```

If this command cannot connect to Docker, open Docker Desktop and wait until it finishes starting.

### Start The App

From the repository root, run:

```bash
docker compose up --build
```

The first run may take a few minutes because Docker needs to download images and build the frontend and backend containers.

When startup finishes, open:

- Frontend app: http://127.0.0.1:5173/
- Backend API: http://127.0.0.1:8000/api/
- Django admin: http://127.0.0.1:8000/admin/

The backend container runs Django migrations automatically before starting the server.

### Database Port

The MySQL container uses port `3306` inside Docker and is exposed to your Mac on port `3307`:

```text
127.0.0.1:3307
```

This avoids conflicts with a local MySQL server that may already be using port `3306`.

Inside Docker, the backend still connects to MySQL with:

```text
MYSQL_HOST=db
MYSQL_PORT=3306
```

### Seed Demo Data

After the containers are running, seed demo operational data with:

```bash
docker compose exec backend python manage.py seed_operational_data
```

### Create An Admin User

Create a Django admin user with:

```bash
docker compose exec backend python manage.py createsuperuser
```

Then log in at:

```text
http://127.0.0.1:8000/admin/
```

### Stop The App

Stop the running containers with:

```bash
docker compose down
```

This keeps the MySQL data volume, so your database data remains available next time.

### Reset The Docker Database

To delete the Docker MySQL data and start fresh:

```bash
docker compose down -v
docker compose up --build
```

Use this only when you intentionally want to remove the Docker database data.

### Start With AI Features

If you want to use AI features, pass your OpenAI API key when starting the stack:

```bash
OPENAI_API_KEY=your-key docker compose up --build
```

## Option B: Start Manually Without Docker

Use this approach when you want to run each service directly on your machine. You need a local MySQL server, Python, and Node.js installed.

### 1. Create The MySQL Database

Create the local database and user expected by the default backend `.env` file:

```sql
CREATE DATABASE inventory_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'inventory_password';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_user'@'localhost';
GRANT ALL PRIVILEGES ON test_inventory_db.* TO 'inventory_user'@'localhost';
FLUSH PRIVILEGES;
```

The default backend configuration expects:

```env
MYSQL_DATABASE=inventory_db
MYSQL_USER=inventory_user
MYSQL_PASSWORD=inventory_password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

For more backend details, see [backend/README.md](./backend/README.md).

### 2. Start The Backend

In the first terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Backend URLs:

- Backend API: http://127.0.0.1:8000/api/
- Django admin: http://127.0.0.1:8000/admin/

### 3. Start The Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5173/
```

### 4. Seed Demo Data Manually

With the backend virtualenv active inside `backend/`, run:

```bash
python manage.py seed_operational_data
```

### 5. Create An Admin User Manually

With the backend virtualenv active inside `backend/`, run:

```bash
python manage.py createsuperuser
```

## Common Problems

### Docker Cannot Connect

Error example:

```text
failed to connect to the docker API
```

Fix: start Docker Desktop, wait until Docker is running, then run:

```bash
docker info
docker compose up --build
```

### Port 3306 Is Already In Use

Error example:

```text
listen tcp 0.0.0.0:3306: bind: address already in use
```

This project maps MySQL to host port `3307`, so this should not happen unless the Compose file was changed back to `3306:3306`.

Use this mapping in `docker-compose.yml`:

```yml
ports:
  - "3307:3306"
```

Then run:

```bash
docker compose up --build
```
