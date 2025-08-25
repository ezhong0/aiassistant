#!/usr/bin/env python3

import re

# Read the project file
with open('AssistantApp.xcodeproj/project.pbxproj', 'r') as f:
    content = f.read()

# Remove old file references that don't exist
old_files = [
    'AppConfiguration.swift',
    'MainAppView.swift', 
    'AuthenticationManager.swift',
    'MessageBubbleView.swift',
    'APIModels.swift',
    'APIService.swift',
    'DebugView.swift',
    'SecurityManager.swift'
]

# Remove build file references for these files
for old_file in old_files:
    # Remove PBXBuildFile entries
    pattern = rf'\s*\w+\s*/\* {re.escape(old_file)} in Sources \*/ = \{{[^}}]+\}};'
    content = re.sub(pattern, '', content)
    
    # Remove file references
    pattern = rf'\s*\w+\s*/\* {re.escape(old_file)} \*/ = \{{[^}}]+\}};'
    content = re.sub(pattern, '', content)
    
    # Remove from build phases
    pattern = rf'\s*\w+\s*/\* {re.escape(old_file)} in Sources \*/,'
    content = re.sub(pattern, '', content)

# Add new file references (simplified)
new_files = [
    ('AuthManager.swift', 'E2DB26F22E53A25D00139AA3'),
    ('ChatView.swift', 'E2DB26F32E53A25D00139AA3'),
    ('ChatViewModel.swift', 'E2DB26F42E53A25D00139AA3')
]

# Add build file entries
build_files_section = content.find('/* Begin PBXBuildFile section */')
insert_pos = content.find('E2DB26FA2E53A25D00139AA3 /* AssistantAppApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = E2DB26F02E53A25D00139AA3 /* AssistantAppApp.swift */; };')

for filename, file_id in new_files:
    if filename not in content:
        build_entry = f"\t\t{file_id}_BUILD /* {filename} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_id} /* {filename} */; }};\n"
        content = content[:insert_pos] + build_entry + content[insert_pos:]

print("Fixed project file!")

# Write back
with open('AssistantApp.xcodeproj/project.pbxproj', 'w') as f:
    f.write(content)