ymaps.ready(() => {
  const map = new ymaps.Map("map", {
    center: [55.781428, 37.710494], //БС
    zoom: 12,
    controls: ["zoomControl"]
  });

  const placemark = new ymaps.Placemark(
    [55.781428, 37.710494],
    {
      balloonContent: "<strong>LinguaNova</strong><br>Языковая школа"
    },
    {
      preset: "islands#blueEducationIcon"
    }
  );

  map.geoObjects.add(placemark);
});
