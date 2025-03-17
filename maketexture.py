from PIL import Image
import numpy as np
import os
import random

# Define colors based on your BABYLON.Color4 values
# BABYLON.Color4(0.1,0.6,0.1,1) -> RGB(26,153,26)
# BABYLON.Color4(0.1,0.7,0.1,1) -> RGB(26,179,26)
# Converting from 0-1 scale to 0-255 scale
G1 = (26, 153, 26)  # Darker green (0.1,0.6,0.1)
G2 = (26, 179, 26)  # Lighter green (0.1,0.7,0.1)

# Create directory for images if it doesn't exist
os.makedirs("generated_images", exist_ok=True)

# Base resolutions
resolutions = [64, 128, 256]

# Generate multiple variations for each resolution
for resolution in resolutions:
    height = resolution
    width = resolution * 6  # Each image is x by 6x
    
    # Generate 2 variations with different random patterns
    for variation in range(1, 3):
        # Create a new image with RGB mode
        img = Image.new('RGB', (width, height))
        
        # Get pixel access for direct manipulation
        pixels = img.load()
        
        # Fill each pixel with either G1 or G2 randomly
        for y in range(height):
            for x in range(width):
                # Randomly choose between G1 or G2
                if random.random() < 0.5:
                    pixels[x, y] = G1
                else:
                    pixels[x, y] = G2
        
        # Save the image as PNG (lossless)
        filename = f"generated_images/green_pattern_{resolution}_{variation}.png"
        img.save(filename, "PNG")
        print(f"Created PNG image: {filename}")

print("All PNG images generated successfully in the 'generated_images' folder.")