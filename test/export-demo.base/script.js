(function(){
  'use strict';
  var script = {"start":"this.init()","id":"rootPlayer","class":"Player","definitions":[
    {"class":"Panorama","id":"panorama_A1","label":trans('panorama_A1.label'),"thumbnailUrl":"media/a.jpg"},
    {"class":"Panorama","id":"panorama_B2","label":trans('panorama_B2.label')},
    {"class":"Video360","id":"video_C3","label":"Recorrido dron"},
    {"class":"PlayList","id":"mainPlayList","items":[{"class":"PanoramaPlayListItem","media":"this.panorama_A1","player":"this.MainViewerPanoramaPlayer","begin":"this.setEndToItemIndex(this.mainPlayList, 0, 1)"},{"class":"PanoramaPlayListItem","media":"this.panorama_B2"},{"class":"Video360PlayListItem","media":"this.video_C3"}]},
    {"class":"IconButton","id":"IconButton_1","data":{"name":"Boton_Info"},"click":function(e){ this.setComponentVisibility(this.Container_1, true, 0, null, null, false); }},
    {"class":"Container","id":"Container_1","data":{"name":"Panel_Info"},"visible":false,"children":["this.Label_1"]},
    {"class":"Label","id":"Label_1","data":{"name":"Texto_Info"},"text":trans('Label_1.text')},
    {"class":"WebFrame","id":"WebFrame_1","data":{"name":"Web_Formulario"},"url":"https://forms.gle/abc"},
    {"class":"HotspotPanoramaOverlay","id":"overlay_1","data":{"label":"Ir a cocina"},"areas":[{"class":"HotspotPanoramaOverlayArea","click":"this.mainPlayList.set('selectedIndex', 1)"}]},
    {"class":"ViewerArea","id":"MainViewer","data":{"name":"Main Viewer"}}
  ],"scripts":{"setComponentVisibility":TDV.Tour.Script.setComponentVisibility,"openLink":TDV.Tour.Script.openLink,"getComponentByName":TDV.Tour.Script.getComponentByName}};
  if (script['data'] == undefined) script['data'] = {};
  script['data']['translateObjs'] = {};
  TDV.PlayerAPI.defineScript(script);
})();
