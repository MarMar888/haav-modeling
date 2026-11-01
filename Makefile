# One-command environment setup:  make setup
# Needs Python 3.10+. Use a different interpreter with:  make setup PYTHON=python3.12

PYTHON ?= python3
VENV   := .venv
BIN    := $(VENV)/bin
STAMP  := $(VENV)/.installed

.DEFAULT_GOAL := help
.PHONY: help setup notebook clean

help:  ## List the available targets
	@grep -E '^[a-z]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-9s %s\n", $$1, $$2}'

setup: $(STAMP)  ## Create .venv and install requirements.txt (re-runs when requirements.txt changes)

$(STAMP): requirements.txt
	@$(PYTHON) -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else "Python 3.10+ required, found " + sys.version.split()[0])'
	test -x $(BIN)/python || $(PYTHON) -m venv $(VENV)
	$(BIN)/python -m pip install --upgrade pip
	$(BIN)/python -m pip install -r requirements.txt
	@touch $@
	@echo "Ready. Run: make notebook"

notebook: setup  ## Open the active model in JupyterLab
	$(BIN)/jupyter lab prop_motor_battery/willmarley.ipynb

clean:  ## Delete .venv
	rm -rf $(VENV)
