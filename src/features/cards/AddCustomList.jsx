/* eslint-disable react/prop-types */
import { useState } from 'react';
import toast from 'react-hot-toast';

function AddCustomList({ setDaily, setLists }) {
  const [listName, setListName] = useState('');
  const [listImg, setListImg] = useState('');
  const [listBody, setListBody] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    const formData = {
      listName,
      listImg,
      listBody,
    };

    try {
      const response = await fetch('http://localhost:3000/api/todos/addCard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      // console.log('Success:', data);
      setLists(data.data);
      setDaily(data.defaultListName);
      setListBody('');
      setListImg('');
      setListName('');
      toast.success('List created succesfully!');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <>
      <input type="radio" name="slide" id="addList" />
      <label htmlFor="addList" className="card">
        <div className="form-title-flex">
          <div className="title-div">
            <h4 className="title-add">ADD A CUSTOM LIST</h4>
          </div>
          <div className="card-form">
            <form
              className="card-item"
              action="/api/todos/addCard"
              method="post"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                name="listName"
                placeholder="Name"
                autoComplete="off"
                required="required"
                value={listName}
                onChange={e => setListName(e.target.value)}
              />
              <br />
              <input
                type="url"
                name="listImg"
                placeholder="Image (url)"
                autoComplete="off"
                required="required"
                value={listImg}
                onChange={e => setListImg(e.target.value)}
              />
              <br />
              <input
                type="text"
                name="listBody"
                placeholder="Description"
                autoComplete="off"
                value={listBody}
                onChange={e => setListBody(e.target.value)}
              />
              <br />
              <button
                className="button-add-list"
                type="submit"
                name="list"
                value="accept"
              >
                Add List
              </button>
            </form>
          </div>
        </div>
        <div className="row-add">
          <div className="description-add">
            <p>You can add additional lists here!</p>
          </div>
        </div>
      </label>
    </>
  );
}

export default AddCustomList;
