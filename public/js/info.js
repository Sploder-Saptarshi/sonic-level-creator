// this function takes in the container identifier for the games page, then makes an ajax
// call and stuff the return result into the container.innerHTML
function showInfo (container) {
    // get the container
    if(container=='skillshot'){
        text = document.getElementById ('whatisskillshot');
    } else if(container=='awardsachievements') {
        text = document.getElementById ('whatisawardsachivements');
    } else if(container=='screenname') {
        text = document.getElementById ('screennamediv');
    } else if(container=='password') {
        text = document.getElementById ('passworddiv');
    } else if(container=='playsegavip') {
        text = document.getElementById ('whatisplaysegavip');
    }

    // show / hide switcher
    if(text.style.display=="block") {
        text.style.display="none";
        text.style.zIndex="0";
    }else{

        text.style.display="block";
        text.style.zIndex="1006";

        // make the ajax request
        var xmlhttp = false;
        try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttp = false;}}
        if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

        // switch to get the appropiate content
        if(container=='skillshot'){
            xmlhttp.open ('GET', HTML_TOP + 'info/index.php?action=whatIsSkillShot', true);
        }else if(container=='screenname'){
            xmlhttp.open ('GET', HTML_TOP + 'info/index.php?action=whatIsScreenName', true);
        }else if(container=='password'){
            xmlhttp.open ('GET', HTML_TOP + 'info/index.php?action=whatIsPassword', true);
        }else if(container=='awardsachievements'){
            xmlhttp.open ('GET', HTML_TOP + 'info/index.php?action=achievements', true);
        }else if(container=='playsegavip'){
            xmlhttp.open ('GET', HTML_TOP + 'info/?action=whatIsPlaySEGAVIPPop', true);
        }

        xmlhttp.onreadystatechange = function () {

            switch (xmlhttp.readyState) {
                case 1 : case 2 : case 3 :
                //text.innerHTML = "Generating feedback box...";
                break;
                case 4 :
                returnHTML = xmlhttp.responseText;
                text.innerHTML = returnHTML;
                break;
            }
        }

        xmlhttp.send (null);
        return;
    }
}
/*
// rollover
function swapPopupButton() {
    infobutton = document.getElementById ('infobutton');
    infobutton.src = "../images/popup-close-btn-ro.gif";
}

// roll out
function showPopupButton() {
    infobutton = document.getElementById ('infobutton');
    infobutton.src = "../images/popup-close-btn-nor.gif";
}
*/
// hide the container
function closeInfo(container) {
    if(container=='skillshot') {
        text = document.getElementById ('whatisskillshot');
    } else if (container=='awardsachievements') {
        text = document.getElementById ('whatisawardsachivements');
    }

    text.style.zIndex="0";
    text.innerHTML = '';
    text.style.display="none";
    return false;
}

/**
 * Function to hide a website "tip" so the user no longer needs to see it...
 */
function hideTip(whichTip) {
    document.getElementById('ps_tip_' + whichTip).style.display = 'none';
    document.cookie = 'ps_tip_' + whichTip + '=true; expires=; path=/'
}

function checkTip(whichTip) {
    var nameEQ = whichTip + "=";
    var ca = document.cookie.split(';');
    for (var i=0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return false;
}

function toolTip (whichOne) {
    tipBlock = document.getElementById (whichOne);

    // show / hide switcher
    if(tipBlock.style.display=="block") {
        tipBlock.style.display="none";
        tipBlock.style.zIndex="0";
    }else{
        tipBlock.style.display="block";
        tipBlock.style.zIndex="1000";
    }
}
