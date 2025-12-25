import os

# --- 設定區 ---
# 輸出的檔案名稱
output_filename = 'project_all_code.txt'

# 要讀取的副檔名 (你可以根據需求自己增加，例如 .c, .cpp, .java)
# 修改這一行，加入 .ts 和 .tsx
valid_extensions = {'.py', '.js', '.html', '.css', '.json', '.md', '.txt', '.sql', '.ts', '.tsx'}

# 要忽略的資料夾 (避免讀到垃圾檔案)
ignore_folders = {'.git', '__pycache__', 'node_modules', 'venv', 'dist', 'build', '.idea', '.vscode'}
# ----------------

def merge_project_files():
    current_dir = os.getcwd()
    print(f"正在掃描資料夾: {current_dir} ...")
    
    with open(output_filename, 'w', encoding='utf-8') as outfile:
        # 寫入開頭說明，讓 AI 知道這是什麼
        outfile.write(f"Project Code Summary\n")
        outfile.write(f"====================\n\n")

        for root, dirs, files in os.walk(current_dir):
            # 移除要忽略的資料夾
            dirs[:] = [d for d in dirs if d not in ignore_folders]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_extensions and file != 'merge_code.py':
                    file_path = os.path.join(root, file)
                    # 計算相對路徑，讓 AI 知道檔案結構
                    rel_path = os.path.relpath(file_path, current_dir)
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                            
                            # 寫入檔案分隔線與檔名
                            outfile.write(f"\n{'='*30}\n")
                            outfile.write(f"File Path: {rel_path}\n")
                            outfile.write(f"{'='*30}\n")
                            outfile.write(content)
                            outfile.write("\n")
                            print(f"已加入: {rel_path}")
                    except Exception as e:
                        print(f"⚠️ 無法讀取 {rel_path}: {e}")

    print(f"\n✅ 完成！請將 '{output_filename}' 上傳給 AI。")

if __name__ == '__main__':
    merge_project_files()