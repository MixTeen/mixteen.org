/* eslint-env browser */

window.events = (function () {
  'use strict';

  let isDevPage = document.currentScript.text.indexOf('dev=true') > -1;

  firebase.initializeApp({
    apiKey: "AIzaSyCs7mysy-27y7UazMDrEwpDAwh5XUsZICI",
    authDomain: "mixteen-d85dc.firebaseapp.com",
    databaseURL: "https://mixteen-d85dc.firebaseio.com",
    storageBucket: "mixteen-d85dc.appspot.com"
  });

  let database = firebase.database();
  let nbElementDisplayed = 2;

  /**
   * Converts result to an array
   * @param index
   * @returns {Array}
   * @private
   */
  function _transformResult(index) {
    if (index) {
      return Object.keys(index).map(key => index[key]);
    }
    return [];
  }

  /**
   * Loads the events file index
   * @param cb
   * @param dirpath
   * @returns {Array}
   * @private
   */
  function _loadEventsIndex(cb) {
    //Data are load from localstorage if they are presents
    const data = localStorage.getItem("eventsIndex");
    if(data){
      cb(_transformResult(JSON.parse(data)));
    }

    database
      .ref(isDevPage ? '/eventsDev' : '/events')
      .on('value', (snapshot) => {
        console.log("fund")
        localStorage.setItem("eventsIndex", JSON.stringify(snapshot.val()));
        cb(_transformResult(snapshot.val()));
      });
  }

  /**
   * Save the events visit for stats
   */
  function _saveVisit(filename) {
    database
      .ref(`/stats${isDevPage ? 'Dev' : ''}/${filename}`)
      .transaction(count => {
        let result = count ? count + 1 : 1;
        document.getElementById('nbview').innerHTML = ` - lu ${result} fois`;
        return result;
      });
  }

  /**
   * Parse the index, find the potential previous events and update the view
   * @param eventsIndex
   * @param filename
   * @private
   */
  function findPreviousEvent(eventsIndex, filename) {
    let previous;
    _saveVisit(filename);
    eventsIndex
      .sort((a, b) => (a.strdate < b.strdate ? 1 : (a.strdate > b.strdate ? -1 : 0)))
      .forEach((elt, index, array) => {
        if (elt.filename === filename) {
          previous = index < array.length ? array[index + 1] : undefined;
        }
      });

    if (previous) {
      document.getElementById('previous-event').innerHTML =
        `<div class="dm-event--previous">Evénement précédent : <a href="../${previous.dir}/${previous.filename}.html">${previous.doctitle}</a></div>`;
    }

  }

  function findComments(filename) {
    database
      .ref(`${isDevPage ? '/commentsDev' : '/comments'}/${filename}`)
      .startAt()
      .on('value', (snapshot) => {
        if (snapshot.val()) {
          let comments = _transformResult(snapshot.val())
            .sort((a, b) => (a.timestamp < b.timestamp ? -1 : (a.timestamp > b.timestamp ? 1 : 0)))
            .map((comment) => `
                <article class="dm-event--comment">
                    <div class="head"><b>${comment.name}</b> : ${comment.date}</div> 
                    <div class="comment">${comment.comment}</div>
                </article>
            `)
            .reduce((a, b) => a + b);

          document.getElementById('comments').innerHTML = `${comments}`;
        }
        else{
          document.getElementById('comments').innerHTML = `Pas de commentaire pour le moment`;
        }
      })
  }

  function formValidate() {
    const form = document.forms['comment'];
    return (form.name.value.trim().length !== 0 && form.comment.value.trim().length !== 0);
  }

  function onFormCommentChange() {
    if (formValidate()) {
      document.getElementById('saveComments').disabled = false;
    }
    else {
      document.getElementById('saveComments').disabled = true;
    }
  }

  let commentVisibility = 'none';
  function displayCommentForm() {
    commentVisibility = commentVisibility === 'block' ? 'none' : 'block';
    document.getElementById('commentFrm').style.display = commentVisibility;
  }

  function saveComment(filename) {
    const date = new Date();
    const form = document.forms['comment'];
    const timestamp = date.toISOString().replace(new RegExp(':', 'g'), '_').replace('.', '_');

    database
      .ref(`${isDevPage ? '/commentsDev' : '/comments'}/${filename}/${timestamp}`)
      .set({
        timestamp: timestamp,
        date: date.toLocaleString('fr'),
        name: form.name.value.trim(),
        comment: form.comment.value.trim(),
        mail: form.mail.value.trim()
      })
      .then(() => {
        form.name.value = '';
        form.comment.value = '';
        form.mail.value = '';
        displayCommentForm();
      });
    return false;
  }

  /**
   * Formats the keywords
   * @param eventDetail
   * @param suffix
   * @returns {*}
   */
  function _getHtmlKeyword(eventDetail, suffix) {
    return eventDetail.keywords
      .split(',')
      .map(keyword => `<span class="dm-event--keyword${suffix}"><small>${keyword}</small></span>&nbsp;`)
      .reduce((a, b) => a + b);
  }

  function _getArticleList(eventDetail) {
    return `
        <tr><td class="dm-event--shortcutlist"><a title="${eventDetail.doctitle}" href="events/${eventDetail.dir}/${eventDetail.filename}.html">${eventDetail.doctitle}</a></td></tr>
        `;
  }

  function _getArticle(eventDetail, first) {
    var article = document.createElement("article");

    article.className = `dm-event--article${first ? '-head' : ''}`;
    article.innerHTML = `
           <${first ? 'h1' : 'h2'}><a href="events/${eventDetail.dir}/${eventDetail.filename}.html">${eventDetail.doctitle}</a></${first ? 'h1' : 'h2'}>     
           <div class="dm-event--container-article-sub">
             <div class="dm-event--imgteaser">
               <img src="${eventDetail.imgteaser}"/>
             </div>
             <div>
                <p class="dm-event--teaser">${eventDetail.teaser}</p>       
             </div>
           </div>
    `;
    article.onclick = function () {
      document.location.href = `events/${eventDetail.dir}/${eventDetail.filename}.html`;
    };

    return article;
  }

  /**
   * Find the last
   * @param eventsIndex
   * @private
   */
  function findLastEvents(eventsIndex) {
    let articles = eventsIndex
      .sort((a, b) => (a.strdate < b.strdate ? 1 : (a.strdate > b.strdate ? -1 : 0)))
      .filter((e, index) => index > 0 && index <= nbElementDisplayed)
      .map((eventDetail) => _getArticle(eventDetail));

    let headArticle = document.getElementById('last-article');
    while (headArticle.firstChild) {
      headArticle.removeChild(headArticle.firstChild);
    }
    headArticle.appendChild(_getArticle(eventsIndex[0], true));
    articles.forEach(article => headArticle.appendChild(article));

    if (nbElementDisplayed >= eventsIndex.length) {
      document.getElementById('more-article').style.display = 'none';
    }
  }

  function findMoreEvent(eventsIndex) {
    nbElementDisplayed += 2;
    findLastEvents(eventsIndex);
  }

  function sendMessage(target, page, title) {
    if ('twitter' === target) {
      document.location.href = `https://twitter.com/intent/tweet?original_referer=${encodeURI(page)}&text=${encodeURI(title) + ' @mixteen_lyon'}&tw_p=tweetbutton&url=${encodeURI(page)}`;
    }
    else if ('google+' === target) {
      document.location.href = `https://plus.google.com/share?url=${encodeURI(page)}&text=${encodeURI(title)}`;
    }
    else if ('linkedin' === target) {
      document.location.href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURI(page)}&text=${encodeURI(title)}`;
    }
    else if ('facebook' === target) {
      document.location.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURI(page)}&description=${encodeURI(title)}`;
    }
  }

  return {
    // Find and update the page to display a link to the previous event
    "findPreviousEvent": (filename) => _loadEventsIndex((eventsIndex) => findPreviousEvent(eventsIndex, filename)),
    // Display the last events
    "findLastEvents": () => _loadEventsIndex((eventsIndex) => findLastEvents(eventsIndex), 'events'),
    // Display more events
    "findMoreEvent": () => _loadEventsIndex((eventsIndex) => findMoreEvent(eventsIndex), 'events'),
    // Send a message
    "sendSocial": sendMessage,
    // Form validation
    "onFormCommentChange": onFormCommentChange,
    // save comment
    "saveComment": saveComment,
    // Find comments
    "findComments": findComments,
    "displayCommentForm" : displayCommentForm
  };
})();

