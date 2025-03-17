from PIL import Image
import numpy as np
import random

# Define image dimensions
height = 256
width = 256 * 6  # 384px

# Define colors (RGB)
light_green = (144, 238, 144)  # Light green
dark_green = (0, 100, 0)      # Dark green

# Create a new image with RGB mode
img = Image.new('RGB', (width, height))

# Get pixel access for direct manipulation
pixels = img.load()

# Fill each pixel with either light green or dark green randomly
for y in range(height):
    for x in range(width):
        # Randomly choose between light green and dark green
        if random.random() < 0.5:
            pixels[x, y] = light_green
        else:
            pixels[x, y] = dark_green

# Save the image
img.save('random_green_pattern.jpg')

print("Image created successfully: random_green_pattern.jpg")