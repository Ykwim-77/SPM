from pathlib import Path
import re
root = Path('frontend')
changed = []
for path in root.rglob('*.tsx'):
    if path.match('src/components/AccessiblePressable.tsx'):
        continue
    text = path.read_text(encoding='utf-8')
    if '<Pressable' not in text:
        continue
    new_text = text
    if 'import AccessiblePressable from' not in new_text:
        rn_import = re.search(r"import \{([^}]*)\} from ['\"]react-native['\"];", new_text)
        if rn_import:
            items = [item.strip() for item in rn_import.group(1).split(',') if item.strip()]
            if 'Pressable' in items:
                items = [item for item in items if item != 'Pressable']
                import_line = ''
                if items:
                    import_line = f"import {{ {', '.join(items)} }} from 'react-native';\n"
                new_text = new_text[:rn_import.start()] + import_line + "import AccessiblePressable from '@/src/components/AccessiblePressable';" + new_text[rn_import.end():]
        if 'import AccessiblePressable from' not in new_text and '<Pressable' in new_text:
            first_import = re.search(r"^(import .* from .*)$", new_text, flags=re.M)
            if first_import:
                pos = first_import.end()
                new_text = new_text[:pos] + '\nimport AccessiblePressable from \'@/src/components/AccessiblePressable\';' + new_text[pos:]
    new_text = new_text.replace('<Pressable', '<AccessiblePressable')
    new_text = new_text.replace('</Pressable>', '</AccessiblePressable>')
    new_text = re.sub(r"^import \{\s*\} from ['\"]react-native['\"];\s*\n", '', new_text, flags=re.MULTILINE)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        changed.append(str(path))
print('changed files:', len(changed))
for p in changed:
    print(p)
