window.addEventListener('load', () => {
    const path = window.location.pathname;  // Получаем текущий путь
  
    if (path.startsWith('/')) {
      const categoryName = path.slice(1).replace(/-/g, ' ');  // Убираем начальный слеш и заменяем дефисы на пробелы
      loadCategoryPage(categoryName);  // Функция для загрузки страницы категории
    }
  });
  
  function loadCategoryPage(categoryName) {
    // Логика загрузки данных для категории по её имени
    console.log("Загружаем категорию:", categoryName);
    
    // Делаем запрос на сервер для получения данных категории по её имени
    fetch(`/api/categories/name/${categoryName}`)
      .then(response => response.json())
      .then(data => {
        // Логика для отображения страницы категории на основе данных
        document.querySelector('#content').innerHTML = `
          <h1>${data.name}</h1>
          <p>${data.desc}</p>
          <div class="products">
            ${data.items.map(item => `
              <div class="product">
                <h2>${item.name}</h2>
                <p>Цена: ${item.minPrice}</p>
              </div>
            `).join('')}
          </div>
        `;
      });
  }
  