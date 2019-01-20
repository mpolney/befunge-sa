.PHONY: all deploy

all:
	find * -iname \*.mml -exec ./buildhtml {} \;

