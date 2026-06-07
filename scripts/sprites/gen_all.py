import subprocess, sys, os

scripts = ['gen_backgrounds.py', 'gen_octagons.py', 'gen_arena.py', 'gen_fighters.py', 'gen_referee.py']
d = os.path.dirname(__file__)

for s in scripts:
    print(f'\n=== {s} ===')
    subprocess.run([sys.executable, os.path.join(d, s)], check=True)

print('\nAll sprites generated.')
