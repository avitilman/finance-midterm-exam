import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def docx_to_txt(docx_path, txt_path):
    try:
        if not os.path.exists(docx_path):
            print(f"Error: file not found at {docx_path}")
            return
            
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        text_runs = []
        # XML tags in docx are of the form {http://schemas.openxmlformats.org/wordprocessingml/2006/main}p
        # and runs are {http://schemas.openxmlformats.org/wordprocessingml/2006/main}t
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        
        # We walk through all paragraph elements
        for elem in root.iter():
            if elem.tag == f'{ns}p':
                para_text = []
                for run in elem.iter(f'{ns}t'):
                    if run.text:
                        para_text.append(run.text)
                text_runs.append("".join(para_text))
            
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(text_runs))
        print("Successfully extracted to: " + os.path.basename(txt_path))
    except Exception as e:
        print("Error extracting: " + str(e).encode('utf-8', errors='ignore').decode('ascii', errors='ignore'))

if __name__ == '__main__':
    f1 = r"c:\Users\aviti\OneDrive - Bar Ilan University\Documents\teaching\מימון\כלכלה חדש\יסודות המימון- כלכלה - שיעור 1-6 מעודכן 18.5.2026 .docx"
    f2 = r"c:\Users\aviti\OneDrive - Bar Ilan University\Documents\teaching\מימון\כלכלה חדש\אגח ונוסחת גורדון - כלכלה -25.5.2026 .docx"
    
    out_dir = r"C:\Users\aviti\.gemini\antigravity-ide\scratch\finance-course-materials"
    docx_to_txt(f1, os.path.join(out_dir, "lecture_1_6.txt"))
    docx_to_txt(f2, os.path.join(out_dir, "bonds_gordon.txt"))
