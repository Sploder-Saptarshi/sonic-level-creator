var formSubmitted = false;

function showFeedback (currentPage, userId) {
    feedbackText = document.getElementById ('feedback');

    if (feedbackText.innerHTML != '') {
        closeFeedback ();
        return;
    }

    feedbackText.style.zIndex="1000";
    var xmlhttp = false;
    try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttp = false;}}
    if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

    xmlhttp.open ('GET', HTML_TOP + 'ajax/feedback.php?query=form&site=playsega&currentPage=' + currentPage + '&userid=' + userId + '&userAgent=' + navigator.userAgent, true);
    xmlhttp.onreadystatechange = function () {
        switch (xmlhttp.readyState) {
            case 1 : case 2 : case 3 :
                //feedbackText.innerHTML = "Generating feedback box...";
                break;
            case 4 :
                returnHTML = xmlhttp.responseText;
                feedbackText.innerHTML = returnHTML;
                break;
        }
    }

    xmlhttp.send (null);

    return;
}

function closeFeedback () {
    feedbackText = document.getElementById ('feedback');
    feedbackText.style.zIndex="0";
    feedbackText.innerHTML = '';
    formSubmitted = false;

    return false;
}

function makeDataString () {
    ds_userid = document.feedback.userid.value;
    ds_email = document.feedback.email.value;
    ds_message = document.feedback.message.value;
    ds_description = document.feedback.description.value;
    ds_data = document.feedback.data.value;

    if (ds_message == '' && ds_description == '') {
        dataString = '';
    } else {
        dataString = '&userid=' + ds_userid + '&email=' + ds_email + '&message=' + ds_message + '&description=' + ds_description + '&data=' + ds_data;
    }

    return dataString;
}

function postFeedback (dataString) {

    var email_filter = /^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;

    if (!formSubmitted) {
        if (dataString == '' || !email_filter.test(document.feedback.email.value)) {
            document.getElementById ('feedbackResult').innerHTML = "Please fill in your e-mail and message..."; // "Please fill in at least one field...";
        } else {
            var xmlhttp = false;
            try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttp = false;}}
            if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

            xmlhttp.open ('GET', HTML_TOP + 'ajax/feedback.php?query=submit' + dataString, true);
            xmlhttp.onreadystatechange = function () {
                switch (xmlhttp.readyState) {
                    case 1 : case 2 : case 3 :
                        document.getElementById ('feedbackResult').innerHTML = "Sending feedback...";
                        break;
                    case 4 :
                        theResult = xmlhttp.responseText;
                        if (theResult == 'success') {
                            document.getElementById ('feedbackResult').innerHTML = 'Sent. Thank you!';
                            document.feedback.email.disabled = true;
                            document.feedback.message.disabled = true;
                            document.feedback.description.disabled = true;
                            document.getElementById ('submitButton').innerHTML = "Close";
                            formSubmitted = true;
                        } else {
                            document.getElementById ('feedbackResult').innerHTML = 'Something went wrong. Please try again later...';
                        }
                        break;
                }
            }

            xmlhttp.send (null);
        }
    } else {
        closeFeedback ();
    }
        return;
}

function findHeight (obj) {
    var curleft = 0;
    if (obj.offsetParent) {
        while(1) {
            curleft += obj.offsetHeight;
            if (!obj.offsetParent) break;
            obj = obj.offsetParent;
        }
    } else if (obj.x) {
        curleft += obj.style.height;
    }

    return curleft;
}

function moveIt (obj, theHeight, offsetHeight) {
	obj.style.position = "absolute";
	obj.style.top = ((theHeight / 2) - offsetHeight) + "px";
	obj.style.marginLeft = "-135px";
}
