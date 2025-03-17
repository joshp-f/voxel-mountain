from PIL import Image
import numpy as np
import os
import random

# Create directory for images if it doesn't exist
os.makedirs("generated_images", exist_ok=True)

# Define colors for rock textures (various shades of gray/brown)
ROCK_COLORS = [
    (110, 100, 90),  # Brownish gray
    (125, 115, 105), # Light brownish gray
    (90, 85, 80),    # Dark gray
    (130, 120, 110), # Tan
    (105, 95, 85)    # Brown gray
]

# Keep the original green colors for other faces (non-rock faces)
G1 = (10, 70, 10)    # Darker green
G2 = (26, 179, 26)   # Lighter green

# Base resolutions
resolutions = [64, 128, 256]

# Generate multiple variations for each resolution
for resolution in resolutions:
    height = resolution
    width = resolution * 6  # Each image is x by 6x
    
    # Generate 4 variations with different random patterns
    for variation in range(1, 5):
        # Create a new image with RGB mode
        img = Image.new('RGB', (width, height))
        
        # Get pixel access for direct manipulation
        pixels = img.load()
        
        # Fill each pixel based on the face
        # Each face is 1/6 of the width
        face_width = width // 6
        
        for y in range(height):
            for x in range(width):
                # Determine which face this pixel belongs to (0-5)
                face = x // face_width
                
                # Faces 1,2,3,4 (index 1,2,3,4) should be rock texture
                if 1 <= face <= 4:
                    # For rock textures, use rock colors
                    pixels[x, y] = random.choice(ROCK_COLORS)
                    
                    # Add some noise to make it more natural looking
                    r, g, b = pixels[x, y]
                    noise = random.randint(-15, 15)
                    pixels[x, y] = (
                        max(0, min(255, r + noise)),
                        max(0, min(255, g + noise)),
                        max(0, min(255, b + noise))
                    )
                else:
                    # For faces 0 and 5, use the original green colors
                    if random.random() < 0.5:
                        pixels[x, y] = G1
                    else:
                        pixels[x, y] = G2
        
        # Save the image as PNG (lossless)
        filename = f"generated_images/green_pattern_{resolution}_{variation}.png"
        img.save(filename, "PNG")
        print(f"Created PNG image: {filename}")

print("All PNG images generated successfully in the 'generated_images' folder.")