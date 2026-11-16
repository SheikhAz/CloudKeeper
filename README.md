# ☁️ CloudKeeper

A personal cloud-based photo and document storage platform built with **React** and **Django**. Users create their own account, connect their own **Cloudinary** storage, and upload, view, and manage their important photos and documents from one visually distinctive interface.

**🔗 Live demo:** [cloud-keeper-eight.vercel.app](https://cloud-keeper-eight.vercel.app)

---

## 💡 The Idea

We often have important photos and documents sitting in a phone gallery, buried among thousands of other files. When we need them the most, finding them is difficult.

CloudKeeper was built to solve that everyday problem: a simple, personal place to store, organize, and quickly access the things that matter, in a storage account the user controls.

---

## ✨ Features

- 🔐 **Personal accounts**: sign up and log in with token-based authentication
- ☁️ **Bring your own storage**: each user connects their own Cloudinary account, and the backend handles the rest
- 📤 **Upload** photos and documents
- 🗑️ **Delete** files, removing them from Cloudinary as well
- 🔌 **Connection status**: see whether your Cloudinary account is connected
- ⚡ **Fast access**: uploaded images are cached in the browser for quick loading
- 🎨 **Creative, modern UI**: photos are displayed in a WebGL strip built with Three.js, plus a custom isometric grid written in TypeScript

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, TypeScript, JavaScript, Three.js |
| Backend | Python, Django, Django REST Framework |
| Authentication | Django-based user accounts with token authentication |
| Cloud Storage | Cloudinary |
| Deployment | Vercel (frontend) |

---

## 📁 Project Structure

```
CloudKeeper/
├── backend/            # Django + DRF API (auth, upload, delete, Cloudinary integration)
├── frontend/           # React app (UI, WebGL photo strip, isometric grid)
├── requirements.txt    # Python dependencies
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A free [Cloudinary](https://cloudinary.com/) account

### 1. Clone the repository

```bash
git clone https://github.com/SheikhAz/CloudKeeper.git
cd CloudKeeper
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate
pip install -r ../requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at the URL shown in your terminal (usually `http://localhost:5173/`).

### 4. Connect your Cloudinary account

After signing up and logging in, provide your Cloudinary credentials (cloud name, API key, API secret) in the app. Your files are stored in **your own** Cloudinary account.

> ⚠️ Never commit API keys or secrets to Git. Keep them in environment variables or `.env` files that are listed in `.gitignore`.

---

## 🧠 How It Works

1. A user signs up and logs in; the backend issues an auth token.
2. The user connects their own Cloudinary account.
3. Uploaded files are sent through the Django API to the user's Cloudinary storage.
4. The React frontend fetches the user's files and renders them in the WebGL strip, caching images in the browser for speed.
5. Deleting a file removes it from the user's Cloudinary account too.

---

## 🤖 Development Notes

I developed the backend architecture and handled the integration between the frontend and backend. I used AI-assisted tools to explore design ideas, implement the visual experience, and build the custom isometric grid in TypeScript, while staying involved in the technical decisions, integration, and problem-solving.

---

## 🔮 Future Improvements

- Folders and tags for better organization
- Search across uploaded files
- Support for additional storage providers (for example, Cloudflare R2)
- Sharing files with secure links

---

## 💭 Philosophy

> Coding is more than learning programming languages. It's about identifying problems, thinking of solutions, and turning those solutions into reality.

**Keep exploring. Keep experimenting. Keep building.**

---

## 👤 Author

**Sheikh Az** ([@SheikhAz](https://github.com/SheikhAz))

Full-stack developer working with Python, Django, React, and modern web technologies.
