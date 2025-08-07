# OG Meta Generator

OG Meta Generator is a Flask-based web application that allows users to create temporary web pages with custom Open Graph (OG) metadata. Users can upload an image and specify OG tags, and the application will generate a temporary page with the provided metadata.

## Features

- Upload images (PNG, JPG, JPEG) up to 16MB
- Specify custom OG metadata (site name, title, description)
- Generate temporary pages with random URLs
- Automatic storage management to limit total disk usage
- Image resizing to maintain maximum dimensions of 2000x2000 pixels

## Prerequisites

- Python 3.7+
- pip (Python package manager)
- ngrok (for exposing the local server to the internet)

## Installation

```sh
git clone https://github.com/yourusername/og-meta-generator.git
cd og-meta-generator
pip install -r requirements.txt
```

## Usage

```sh
python app.py
ngrok http 5000
```

1. The application will be available at `http://localhost:5000`.
2. To expose the application to the internet using ngrok:
   - Open a new terminal window
   - Run: `ngrok http 5000`
   - Ngrok will provide a public URL that forwards to your local Flask application
3. Access the application through your web browser and follow the on-screen instructions to create temporary pages with custom OG metadata.

## Configuration

You can modify the following variables in `app.py` to adjust the application's behavior:

- `UPLOAD_FOLDER`: Directory where temporary pages are stored
- `ALLOWED_EXTENSIONS`: Allowed file types for image uploads
- `MAX_STORAGE_SIZE`: Maximum total storage size for temporary pages
- `MAX_IMAGE_RESOLUTION`: Maximum dimensions for uploaded images

## Project Structure

```sh
og-meta-generator/
├── app.py
├── templates/
│   └── upload.html
├── temp_pages/
└── README.md
```

## Security

TODO: security measures before deployment

- Input sanitization
- Rate limiting
- Secure file handling
- HTTPS

## URL spoofing for Discord

[https://̒www.cbsnews.com/news/presidential-debate-harris-trump-structure-prep](https://www.youtube.com/watch?v=JxOFPkCo5MA)
