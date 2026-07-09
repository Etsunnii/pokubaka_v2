const NO_IMAGE_SRC = '/assets/images/no-image.svg'

export const logLeaderProducts = (leaderProducts, categoryContainer) => {
	const newCategoryBlock = document.createElement('section');
	newCategoryBlock.classList.add('category');
	newCategoryBlock.innerHTML = `
	  <div class="category__title-block">
		<div class="container">
		  <h2 class="category__title">Лидеры продаж</h2>
		</div>
	  </div>
	  <div class="container">
		<div class="category__content"></div>
	  </div>
	`;
  
	for (let product of leaderProducts.products) {
	  const categoryName = product.category?.name.replace(/\s+/g, '-');
	  const newProductElem = document.createElement('div');
	  newProductElem.classList.add('category__product', 'category-product');
	  newProductElem.setAttribute('data-category-name', categoryName);
	  newProductElem.setAttribute('data-product-id', product.id);
  
	  newProductElem.innerHTML = `
		<img
		  src="${product.img || product.imageUrl || NO_IMAGE_SRC}"
		  class="category-product__img"
		  alt="${product.name}"
		/>
		<p class="category-product__category">${product.category?.name}</p>
		<h3 class="category-product__name">${product.name}</h3>
		<div class="category-product__price-row">
		  <span class="category-product__price">От ${product.minPrice} ₽</span>
		  ${product.oldPrice ? `<span class="category-product__old-price">${product.oldPrice} ₽</span>` : ''}
		</div>
	  `;
  
	  const contentBlock = newCategoryBlock.querySelector('.category__content');
	  contentBlock.append(newProductElem);
  
	  newProductElem.addEventListener('click', () => {
		if (categoryName && product.id) {
		  window.location.href = `/${categoryName}/${product.id}`;
		}
	  });
	}
  
	categoryContainer.append(newCategoryBlock);
  };
