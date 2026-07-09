export const sortingCatsForTypes = categories => {
	const newArr = []
	for (let cat of categories) {
		let isExist = false
		for (let obj of newArr) {
			if (cat.type === obj.type) {
				obj.categories.push(cat)
				isExist = true
			}
		}
		if (!isExist) {
			const newObj = {
				type: cat.type,
				categories: [cat],
			}
			newArr.push(newObj)
		}
	}
	return newArr
	// if (categories.length) {
	// 	const newArr = categories.map(category => ({
	// 		category: category.name,
	// 		products: products.filter(product => product.category === category.id),
	// 	}))
	// 	return newArr
	// } else {
	// 	const newArr = [
	// 		{
	// 			category: 'Другие',
	// 			products,
	// 		},
	// 	]
	// 	return newArr
	// }
}
