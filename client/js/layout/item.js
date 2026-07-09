const infoDesc = document.querySelector('.info__desc')
const infoSpoilerBtn = document.querySelector('.info__spoiler')
const infoSpoilerIcon = document.querySelector('.info__spoiler-icon')
const infoCalc = document.querySelector('.info__calc')

infoSpoilerBtn.addEventListener('click', e => {
	e.preventDefault()
	if (!infoSpoilerBtn.classList.contains('open')) {
		infoSpoilerBtn.classList.add('open')
		infoSpoilerIcon.classList.add('rotate')
		infoDesc.classList.add('open')
		infoSpoilerBtn.querySelector('p').textContent = 'Скрыть описание'
	} else {
		infoSpoilerBtn.classList.remove('open')
		infoDesc.classList.remove('open')
		infoSpoilerIcon.classList.remove('rotate')
		infoSpoilerBtn.querySelector('p').textContent = 'Показать описание'
	}
})
