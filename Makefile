###################################################################################################
# setup jakets and basic tools
#

SEARCH_JAKETS__DIRS += ./node_modules/jakets
JAKETS__MAKEFILES = $(patsubst %,%/Makefile,$(SEARCH_JAKETS__DIRS))
JAKETS__MAKEFILE = $(word 1, $(wildcard $(JAKETS__MAKEFILES)))

ifeq ("$(JAKETS__MAKEFILE)","")
  ifneq ("$(shell npm --version 2> /dev/null)", "")
    CMD_OUT += $(shell npm update --no-save)
    $(info found npm)
  endif
endif

JAKETS__MAKEFILE = $(word 1, $(wildcard $(JAKETS__MAKEFILES)))
ifeq ("$(JAKETS__MAKEFILE)","")
  JAKETS__MAKEFILE = $(lastword $(JAKETS__MAKEFILES))
  JAKETS__DIR = $(dir $(JAKETS__MAKEFILE))
  CMD_OUT += $(shell mkdir -p $(JAKETS__DIR) )
  CMD_OUT += $(shell curl https://raw.githubusercontent.com/reshadi/jakets/v5.x.x/Makefile --create-dirs -o $(JAKETS__MAKEFILE) )
  $(info CMD_OUT="$(CMD_OUT)" )
endif
$(info JAKETS__DIR="$(dir $(JAKETS__MAKEFILE))" )
$(info JAKETS__MAKEFILE="$(JAKETS__MAKEFILE)" )

JAKE_TASKS += debug release
LOG_LEVEL?=0
# NODE__DIR?=./build/nodejs
include $(JAKETS__MAKEFILE)

#
###################################################################################################


###################################################################################################
# optional custom rules
#

#
####################################################################################################
