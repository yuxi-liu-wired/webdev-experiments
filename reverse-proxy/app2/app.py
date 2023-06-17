from flask import Flask
import datetime

app = Flask(__name__)

@app.route('/') # call this when the root URL '/' is accessed.
def hello():
    return f'Hello World from app 2! I have weight 1/3. Current time is {datetime.datetime.now()}\n'

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int("5000"), debug=False) 

