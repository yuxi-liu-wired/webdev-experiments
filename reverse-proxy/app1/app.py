from flask import Flask
app = Flask(__name__)

@app.route('/') # call this when the root URL '/' is accessed.
def hello():
    return 'Hello World from app 1! I have weight 2/3.\n'

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int("5000"), debug=False) 