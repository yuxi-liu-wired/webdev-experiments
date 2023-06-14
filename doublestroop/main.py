from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)
difficulty = 4

# Defining a list of color hex codes
colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
          "#C0C0C0", "#808080", "#800000", "#808000", "#008000", "#800080",
          "#008080", "#000080", "#000000", "#FFFFFF"]

@app.route('/')
def index():    
    return render_template('index.html')


@app.route('/right')
def right():
    random.shuffle(colors)
    hex_codes = random.sample(colors, k=difficulty)
    hex_codes_left = hex_codes.copy()
    random.shuffle(hex_codes_left)
    hex_codes_right = hex_codes.copy()
    random.shuffle(hex_codes_right)
    hex_colors_left = hex_codes.copy()
    random.shuffle(hex_colors_left)
    hex_colors_right = hex_codes.copy()
    random.shuffle(hex_colors_right)
    print(hex_colors_left)
    print(hex_colors_right)
    
    return render_template('right.html', 
                           hex_codes_left=hex_codes_left, hex_codes_right=hex_codes_right, 
                           hex_colors_left=hex_colors_left, hex_colors_right=hex_colors_right, 
                           zip=zip)
@app.route('/left')
def left():
    random.shuffle(colors)
    hex_codes = random.sample(colors, k=difficulty)
    hex_codes_left = hex_codes.copy()
    random.shuffle(hex_codes_left)
    hex_codes_right = hex_codes.copy()
    random.shuffle(hex_codes_right)
    hex_colors_left = hex_codes.copy()
    random.shuffle(hex_colors_left)
    hex_colors_right = hex_codes.copy()
    random.shuffle(hex_colors_right)
    print(hex_colors_left)
    print(hex_colors_right)
    
    return render_template('left.html', 
                           hex_codes_left=hex_codes_left, hex_codes_right=hex_codes_right, 
                           hex_colors_left=hex_colors_left, hex_colors_right=hex_colors_right, 
                           zip=zip)

if __name__ == '__main__':
    app.run(debug=False)

