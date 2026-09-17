function notifyOfLeaving(theURL) {
    if (confirm ("Please note that you will lose any progress if you continue without saving. Continue?"))
        window.location = theURL;
}
