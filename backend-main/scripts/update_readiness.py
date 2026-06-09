import sys

with open(sys.argv[1], 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines, 1):
    new_lines.append(line)
    if i == 15 and 'from utils.filters import' in line:
        new_lines.append('from utils.afro_countries import AFRO_COUNTRIES_LOWER\n')

output = []
for line in new_lines:
    if '"countries": self.queryset.values_list("country_lower", flat=True).distinct()' in line:
        indent = len(line) - len(line.lstrip())
        output.append(' ' * indent + '"countries": [c for c in self.queryset.values_list("country_lower", flat=True).distinct() if c.lower() in AFRO_COUNTRIES_LOWER],\n')
    else:
        output.append(line)

with open(sys.argv[1], 'w') as f:
    f.writelines(output)

print("Updated readiness/views.py successfully!")
