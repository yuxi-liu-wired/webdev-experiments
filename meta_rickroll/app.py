import os
import random
import string
from flask import Flask, request, render_template, send_from_directory, abort
from werkzeug.utils import secure_filename
from PIL import Image
import html

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = "temp_pages"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
MAX_STORAGE_SIZE = 1000000000  # 1GB in bytes
MAX_IMAGE_RESOLUTION = (2000, 2000)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1MB max upload size

# Load jinja2 template


def generate_random_name():
    return "".join(random.choices(string.ascii_lowercase, k=10))


def get_oldest_directory():
    return min(
        (
            os.path.join(UPLOAD_FOLDER, d)
            for d in os.listdir(UPLOAD_FOLDER)
            if os.path.isdir(os.path.join(UPLOAD_FOLDER, d))
        ),
        key=os.path.getctime,
    )


def get_total_size(directory):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(directory):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            total_size += os.path.getsize(fp)
    return total_size


@app.route("/", methods=["GET", "POST"])
def upload_file():
    if request.method == "POST":
        if "file" not in request.files:
            return "No file part"
        file = request.files["file"]
        if file.filename == "":
            return "No selected file"
        if file:
            filename = secure_filename(file.filename)
            random_name = generate_random_name()
            page_dir = os.path.join(app.config["UPLOAD_FOLDER"], random_name)
            os.makedirs(page_dir, exist_ok=True)
            file_path = os.path.join(page_dir, filename)
            file.save(file_path)

            # Resize image if necessary
            with Image.open(file_path) as img:
                img.thumbnail(MAX_IMAGE_RESOLUTION)
                img.save(file_path)

            # Create HTML file with OG meta tags
            og_site_name = request.form.get("og_site_name", "")
            og_title = request.form.get("og_title", "")
            og_description = request.form.get("og_description", "")

            og_site_name = html.escape(og_site_name)
            og_title = html.escape(og_title)
            og_description = html.escape(og_description)

            html_content = render_template(
                "template.html",
                og_site_name=og_site_name,
                og_title=og_title,
                og_description=og_description,
                random_name=random_name,
            )

            with open(os.path.join(page_dir, "index.html"), "w") as f:
                f.write(html_content)

            # Check and manage storage
            while get_total_size(app.config["UPLOAD_FOLDER"]) > MAX_STORAGE_SIZE:
                oldest_dir = get_oldest_directory()
                for root, dirs, files in os.walk(oldest_dir, topdown=False):
                    for name in files:
                        os.remove(os.path.join(root, name))
                    for name in dirs:
                        os.rmdir(os.path.join(root, name))
                os.rmdir(oldest_dir)

            return f"Page created: /{random_name}"
    return render_template("upload.html")


@app.route("/<random_name>")
def serve_page(random_name):
    page_dir = os.path.join(app.config["UPLOAD_FOLDER"], random_name)
    if os.path.exists(os.path.join(page_dir, "index.html")):
        return send_from_directory(page_dir, "index.html")
    abort(404)


@app.route("/<random_name>/<filename>")
def serve_image(random_name, filename):
    return send_from_directory(
        os.path.join(app.config["UPLOAD_FOLDER"], random_name), filename
    )


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)
