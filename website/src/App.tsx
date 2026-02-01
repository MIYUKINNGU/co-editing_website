import { useState, useEffect } from 'react'
import './App.css'

function HeaderButton({ value, clickEvent, disabled }: { value: string, clickEvent: React.MouseEventHandler<HTMLButtonElement>, disabled: boolean }) {
  return (
    <button className="headerButton" onClick={clickEvent} disabled={disabled}>{value}</button>
  )
}

function App() {
  const [ fileNames, setFiles ] = useState<string[]>([]);
  const [ fileIndex, setFileIndex ] = useState<number>(0);
  const [ isEditing, setEditState ] = useState<boolean>(false);
  const [ contents, setContents ] = useState<string>("");

  function updateContent() {
    if (isEditing) return;
    fetch(`/api/mdEditor/${fileNames[fileIndex]}/Contents`, {method: "GET"})
    .then(res => res.json())
    .then(
      data => setContents(data.contents)
    )
  }
  
  function listContent({ fileName, fileIndex }: { fileName: string, fileIndex: number }) {
    return (
      <li className={fileNames[fileIndex] === fileName ? "fileSelectItem selectingItem" : "fileSelectItem"} role="treeitem" onClick={() => selectFile(fileName)}>{fileName}</li>
    )
  }

  function selectFile(fileName: string) {
    const fileindex = fileNames.indexOf(fileName)
    console.log(`clicked: ${fileindex}`)
    fetch(`/api/mdEditor/${fileNames[fileIndex]}/EndEdit`, {method: "PUT"})
    setEditState(false);
    setFileIndex(fileindex);
    updateContent();
  }

  function editFile(content: React.ChangeEvent<HTMLTextAreaElement, HTMLTextAreaElement>) {
    console.log(`Sent POST to '/api/mdEditor/${fileNames[fileIndex]}/Edited'`)
    setContents(content.target.value)
    fetch(`/api/mdEditor/${fileNames[fileIndex]}/Edited`, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: content.target.value,
        session: sessionStorage.getItem("session")
      })
    })
  }

  useEffect(() => {
    fetch("/api/mdEditor/getAllFileNames", {method: "GET"})
    .then(
      res => res.json()
    ).then(
      data => setFiles(data.files)
    )
  }, []);

  useEffect(updateContent, [fileNames, fileIndex, isEditing])

  useEffect(() => {
    const callback = () => {
      fetch(`/api/mdEditor/${fileNames[fileIndex]}/EndEdit`, {method: "PUT"})
    }

    window.addEventListener('beforeunload', callback)

    return () => window.removeEventListener('beforeunload', callback)
  }, [fileNames, fileIndex])

  useEffect(() => {
    const timer = setInterval(updateContent, 500);

    return () => clearInterval(timer);
  });

  return (
    <>
      <div className="header">
        <HeaderButton disabled={false} value={isEditing ? "Save" :"Edit"} clickEvent={
          isEditing ? () => {
            fetch(`/api/mdEditor/${fileNames[fileIndex]}/EndEdit`, {method: "PUT"})
            setEditState(false);
          }
          : () => {
          fetch(`/api/mdEditor/${fileNames[fileIndex]}/RequestEdit`, {method: "POST"})
          .then(
            res => res.json()
          ).then(
            data => {
              setEditState(data.permission)
              sessionStorage.setItem("session", data.editor);
            }
          )
        }}/>
        <div className="editState"><span>{isEditing ? "Edit Mode" : "Preview Mode"}</span></div>
      </div>
      <div className="main">
        <div className="fileSelect">
          <ul role="tree">
            {fileNames.map(fn => listContent({ fileName: fn, fileIndex: fileIndex}))}
          </ul>
        </div>
        <div className="editor">
          <textarea id="editorContents" value={contents} placeholder="Start typing anything to dismiss..." disabled={!isEditing} className="editorContents" onChange={editFile}></textarea>
        </div>
      </div>
    </>
  )
}

export default App
