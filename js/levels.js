var xmlhttpLevels = new Array();
var levelsText = new Array();

function changeTitle (whichDiv, theTitle) {
    document.getElementById (whichDiv).innerHTML = theTitle;
}

function changeValue (whichDiv, theValue) {
    document.getElementById (whichDiv).value = theValue;
}

function getValue (whichDiv) {
    return(document.getElementById (whichDiv).value);
}

function getLevels (whichDiv, editorid, userid, levelstatusid, start, limit, orderby) {
    levelsText[whichDiv] = document.getElementById (whichDiv);

    xmlhttpLevels[whichDiv] = false;
    try {xmlhttpLevels[whichDiv] = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttpLevels[whichDiv] = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttpLevels[whichDiv] = false;}}
    if (!xmlhttpLevels[whichDiv] && typeof XMLHttpRequest != 'undefined') xmlhttpLevels[whichDiv] = new XMLHttpRequest ();

    xmlhttpLevels[whichDiv].open ('GET', HTML_TOP + 'ajax/levels.php?editorid=' + editorid + '&userid=' + userid + '&levelstatusid=' + levelstatusid + '&start=' + start + '&limit=' + limit + '&orderby=' + orderby, true);
    xmlhttpLevels[whichDiv].onreadystatechange = function () {
        switch (xmlhttpLevels[whichDiv].readyState) {
            case 1 : case 2 : case 3 :
                levelsText[whichDiv].innerHTML = '<div class="ajax-loader">&nbsp;</div>';
            break;
            case 4 :
                returnHTML = '';
                resultXML = xmlhttpLevels[whichDiv].responseXML;

                result = resultXML.getElementsByTagName ("result");
                count = result[0].getAttribute("count");
                items = result[0].getElementsByTagName ("item");

                for (x = 0; x < items.length; x++) {
                    //returnHTML += items[x].getAttribute("userid");
                    //alert (items[x]);
                    //for each (asd in items[x]) returnHTML += asd + '<br />';
                    returnHTML += items[x].firstChild.nodeValue;
                }

                levelsText[whichDiv].innerHTML = returnHTML;
                break;
        }
    }

    xmlhttpLevels[whichDiv].send (null);

    return;
}

function deleteLevel (levelid) {
    var doDelete = confirm("Do you really want to delete this level?");
    if (!doDelete) {
        return;
    }

    xmlhttpDelete = false;
    try {xmlhttpDelete = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttpDelete = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttpDelete = false;}}
    if (!xmlhttpDelete && typeof XMLHttpRequest != 'undefined') xmlhttpDelete = new XMLHttpRequest ();

    xmlhttpDelete.open ('GET', HTML_TOP + 'ajax/deletelevel.php?levelid=' + levelid, true);
    xmlhttpDelete.onreadystatechange = function () {
        switch (xmlhttpDelete.readyState) {
            case 1 : case 2 : case 3 :
                //levelsText[whichDiv].innerHTML = "Fetching data...";
                break;
            case 4 :
                returnHTML = '';
                resultXML = xmlhttpDelete.responseXML;

                result = resultXML.getElementsByTagName ("result");
                success = result[0].getAttribute ('success');

                if (success == 'true') {
	                theLevelBox = $('levelbox_' + levelid);
	                theLevelBox.innerHTML = "LEVEL DELETED";
	                theLevelBox.morph('.levelThumbDeleted');
                } else {
                	alert ('Unable to delete level!');
                }
            break;
        }
    }

    xmlhttpDelete.send (null);

    return;
}

var levelsExpanded = false;
var levelsOptions;

function collapseLevels (whichOne) {
    switch (whichOne) {
        case 'levels' :
            levelsExpanded = false;
            levelsOptions.morph('.middleInactiveTwo');
        break;
    }
}

function expandLevels (whichOne) {
    switch (whichOne) {
        case 'levels' :
            levelsExpanded = true;
            levelsOptions.morph('.middleActiveTwo');
        break;
    }
}
