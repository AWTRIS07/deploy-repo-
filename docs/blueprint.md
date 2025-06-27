# **App Name**: LineFollowerPi Control

## Core Features:

- Speed Control: Firebase-synced speed control with slider or numeric input. Note: current system uses 0-100 for simplicity
- Destination Selection: Destination Tag selection from a list of detected NFC tags (1-13) as destination points.
- Motor PWM Confirmation: Real-time feedback: Display motor PWM level on the interface, as confirmation that Pi code is running
- NFC Tag Reading & Auto-Assignment: Automatically assign incremental numbers (1, 2, 3,...13) to unique NFC tags and log into Firebase.
- Map Layout Visualization: Visually display a map image with NFC tag locations overlaid. Use: sandbox:/mnt/data/top_view_map_with_user_tags.png

## Style Guidelines:

- Primary color: Medium cyan (#4AC0F2) for a techy feel.
- Background color: Light cyan (#E0F7FA) for a clean, calm background.
- Accent color: Light orange (#F2B34A) for interactive elements.
- Body and headline font: 'Inter' (sans-serif) for a modern and neutral interface.
- Simple line icons representing robot movement and NFC tags.
- Split-screen layout with controls on one side and map visualization on the other.