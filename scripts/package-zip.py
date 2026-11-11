import os
import zipfile

def create_zip(output_path, root_dir):
    exclude_dirs = {'node_modules', '.git', 'dist', '.aistudio', '__pycache__', '.cache'}
    exclude_files = {'kamch-erp-fees-stage3.zip'}
    
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file in exclude_files:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, root_dir)
                zipf.write(file_path, arcname)

if __name__ == '__main__':
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    out_zip = os.path.join(project_root, 'public', 'kamch-erp-fees-stage3.zip')
    print(f"Packaging {project_root} -> {out_zip}...")
    create_zip(out_zip, project_root)
    file_size_mb = os.path.getsize(out_zip) / (1024 * 1024)
    print(f"Successfully created {out_zip} ({file_size_mb:.2f} MB)")
