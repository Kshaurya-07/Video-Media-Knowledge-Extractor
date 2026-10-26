import wave
import struct
import math
from pathlib import Path

output_path = Path(__file__).parent / "samples" / "demo_presentation.wav"
output_path.parent.mkdir(parents=True, exist_ok=True)

# Generate a 45-second multi-tone audio file simulating speech intervals
sample_rate = 16000
duration = 45  # seconds
num_samples = duration * sample_rate

with wave.open(str(output_path), "w") as wav_file:
    wav_file.setnchannels(1)  # mono
    wav_file.setsampwidth(2)  # 16-bit
    wav_file.setframerate(sample_rate)

    for i in range(num_samples):
        t = i / sample_rate
        # Create subtle pitch variations simulating conversational cadence
        freq = 220.0 + 80.0 * math.sin(2 * math.pi * 0.5 * t)
        # Modulate amplitude with speech pauses
        envelope = 0.5 * (1 + math.sin(2 * math.pi * 0.25 * t))
        if int(t) % 6 == 5:
            envelope = 0.05  # brief pause
        sample = int(32767.0 * 0.3 * envelope * math.sin(2 * math.pi * freq * t))
        wav_file.writeframesraw(struct.pack("<h", sample))

print(f"Generated demo audio: {output_path} ({output_path.stat().st_size} bytes)")
