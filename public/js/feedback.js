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

// Language choice (EnglishUK / EnglishUSA): saved to localStorage with no
// page refresh. Flag clicks are intercepted below; the stored value is
// re-applied to the flags widget on every page load.
var PLAYSEGA_LANG_KEY = 'playsega.language';

function playsegaLanguage () {
    var v = null;
    try { v = localStorage.getItem(PLAYSEGA_LANG_KEY); } catch (e) {}
    return (v === 'EnglishUSA' || v === 'EnglishUK') ? v : null;
}

function playsegaMarkLanguage (lang) {
    // Show the selected flag on top: move the chosen language div into
    // .flag_top and park the other one in .footer (anchors move along).
    var top = document.querySelector ('#flags .flag_top');
    var foot = document.querySelector ('#flags .footer');
    var uk = document.querySelector ('#flags .EnglishUK');
    var usa = document.querySelector ('#flags .EnglishUSA');
    if (!top || !foot || !uk || !usa) return;
    var first = (lang === 'EnglishUSA') ? usa : uk;
    var second = (lang === 'EnglishUSA') ? uk : usa;
    top.insertBefore (first, top.firstChild);
    foot.insertBefore (second, foot.firstChild);
}

function playsegaSetLanguage (lang, ev) {
    if (ev && ev.preventDefault) ev.preventDefault ();
    try { localStorage.setItem (PLAYSEGA_LANG_KEY, lang); } catch (e) {}
    playsegaMarkLanguage (lang);
    return false;
}

function playsegaWireLanguageFlags () {
    var uk = document.querySelector ('#flags .EnglishUK a');
    var usa = document.querySelector ('#flags .EnglishUSA a');
    if (uk) uk.onclick = function (ev) { return playsegaSetLanguage ('EnglishUK', ev || window.event); };
    if (usa) usa.onclick = function (ev) { return playsegaSetLanguage ('EnglishUSA', ev || window.event); };
    playsegaMarkLanguage (playsegaLanguage ());
}

if (document.addEventListener) {
    document.addEventListener ('DOMContentLoaded', playsegaWireLanguageFlags, false);
} else if (window.attachEvent) {
    window.attachEvent ('onload', playsegaWireLanguageFlags);
}
