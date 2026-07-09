import { createSlug } from '../../functions/logic/slugify.js'

const NO_IMAGE_SRC = '/assets/images/no-image.svg'

const escapeHtml = value =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')

export const logProductsAndCategories = (productsArr, categoryContainer) => {
	for (let objProdWithCat of productsArr) {
		const newCategoryBlock = document.createElement('section')
		newCategoryBlock.classList.add('category')
		newCategoryBlock.innerHTML = `
		<div class="category__title-block">
		  <div class="container">
			<h2 class="category__title">${escapeHtml(objProdWithCat.type)}</h2>
		  </div>
		</div>
		<div class="container">
		  <div class="category__content"></div>
		</div>
	  `

		for (let product of objProdWithCat.categories) {
			const categoryName = createSlug(product.name)
			const newProductElem = document.createElement('div')
			newProductElem.classList.add('category__product', 'category-product')
			newProductElem.setAttribute('data-category-name', categoryName)

			newProductElem.innerHTML = `
		  <img
			src="${escapeHtml(product.img || NO_IMAGE_SRC)}"
			class="category-product__img"
			alt="cat img"
		  />
		  <p class="category-product__category">${escapeHtml(product.type)}</p>
		  <h3 class="category-product__name">${escapeHtml(product.name)}</h3>
		  <div class="category-product__price-row">
			<span class="category-product__price">От ${product.minPrice} ₽</span>
			${product.oldPrice ? `<span class="category-product__old-price">${product.oldPrice} ₽</span>` : ''}
		  </div>
		`

			const contentBlock = newCategoryBlock.querySelector('.category__content')
			contentBlock.append(newProductElem)
		}

		categoryContainer.append(newCategoryBlock)
	}
}
