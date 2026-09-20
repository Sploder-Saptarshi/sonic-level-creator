var reportExpanded = false;
var reportArea;

function expandReport() {
    if (reportExpanded) {
        reportExpanded = false;
        //reportArea.morph('.reportReportHidden');
        reportArea.className = 'reportReportHidden';
    } else {
        reportExpanded = true;
        //reportArea.morph('.reportReportShown');
        reportArea.className = 'reportReportShown';
    }        
}

function newXMLHTTP () {
    var xmlhttp = false;
    try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttp = false;}}
    if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

    return xmlhttp;
}

function postReport () {
    var levelid = document.getElementById ('frm_levelid').value;
    var reason = document.getElementById ('frm_reason').value.replace (/^\s+|\s+$/g, '');
    var result = document.getElementById ('reportResult');
    if (!reason) {
        result.innerHTML = 'Please tell us why this level is inappropriate.';
        return;
    }
    result.innerHTML = '<div class="ajax-loader">&nbsp;</div>';
    fetch ('/api/levels/' + encodeURIComponent (levelid) + '/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify ({ reason: reason })
    }).then (function (res) {
        if (res.status === 401) {
            result.innerHTML = 'Please <a href="/member/signin">sign in</a> to report a level.';
            return;
        }
        if (!res.ok) {
            result.innerHTML = 'Something went wrong. Please try again.';
            return;
        }
        document.getElementById ('reportContent').innerHTML = 'Thank you, your report has been sent and we will <br />review it and take action accordingly.';
    }).catch (function () {
        result.innerHTML = 'Something went wrong. Please try again.';
    });
}
